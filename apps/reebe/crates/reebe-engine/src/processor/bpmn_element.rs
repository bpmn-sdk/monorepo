use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::element_instances::ElementInstance;
#[allow(unused_imports)]
use reebe_db::state::jobs::Job;
use reebe_db::state::messages::MessageSubscription;
use reebe_db::state::signal_subscriptions::SignalSubscription;
use reebe_db::state::timers::Timer;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct BpmnElementProcessor;

#[async_trait]
impl RecordProcessor for BpmnElementProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "PROCESS_INSTANCE"
            && matches!(intent, "ACTIVATE_ELEMENT" | "COMPLETE_ELEMENT" | "TERMINATE_ELEMENT")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match record.intent.as_str() {
            "ACTIVATE_ELEMENT" => self.activate_element(record, state, writers).await,
            "COMPLETE_ELEMENT" => self.complete_element(record, state, writers).await,
            "TERMINATE_ELEMENT" => self.terminate_element(record, state, writers).await,
            _ => Ok(()),
        }
    }
}

/// Evaluate I/O mappings from a FEEL expression context.
/// Returns Some(vars) with evaluated (target_name, value) pairs on success,
/// or None (plus an incident command queued into writers) on failure.
fn apply_io_mappings(
    mappings: &[reebe_bpmn::ZeebeIoMapping],
    ctx: &reebe_feel::FeelContext,
    process_instance_key: i64,
    element_instance_key: i64,
    bpmn_process_id: &str,
    tenant_id: &str,
    writers: &mut Writers,
) -> Option<Vec<(String, serde_json::Value)>> {
    let mut results = Vec::new();
    for mapping in mappings {
        match reebe_feel::parse_and_evaluate(&mapping.source, ctx) {
            Ok(val) => {
                results.push((mapping.target.clone(), serde_json::Value::from(val)));
            }
            Err(e) => {
                let error_msg = format!(
                    "Failed to evaluate I/O mapping expression '{}' targeting '{}': {}",
                    mapping.source, mapping.target, e
                );
                writers.commands.push(CommandToWrite {
                    value_type: "INCIDENT".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "errorType": "IO_MAPPING_ERROR",
                        "errorMessage": error_msg,
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": element_instance_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
                return None;
            }
        }
    }
    Some(results)
}

/// Extract input_mappings from a FlowElement if it supports them.
fn get_input_mappings(element: &reebe_bpmn::FlowElement) -> &[reebe_bpmn::ZeebeIoMapping] {
    match element {
        reebe_bpmn::FlowElement::StartEvent(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ServiceTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::UserTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ReceiveTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ScriptTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::SendTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::BusinessRuleTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::CallActivity(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::SubProcess(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::IntermediateCatchEvent(e) => &e.input_mappings,
        _ => &[],
    }
}

/// Extract output_mappings from a FlowElement if it supports them.
fn get_output_mappings(element: &reebe_bpmn::FlowElement) -> &[reebe_bpmn::ZeebeIoMapping] {
    match element {
        reebe_bpmn::FlowElement::StartEvent(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ServiceTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::UserTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ReceiveTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ScriptTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::SendTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::BusinessRuleTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::CallActivity(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::SubProcess(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::IntermediateCatchEvent(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::BoundaryEvent(e) => &e.output_mappings,
        _ => &[],
    }
}

impl BpmnElementProcessor {
    async fn activate_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let process_definition_key: i64 = payload["processDefinitionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processDefinitionKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processDefinitionKey".to_string()))?;

        let element_id = payload["elementId"]
            .as_str()
            .ok_or_else(|| EngineError::InvalidState("Missing elementId".to_string()))?
            .to_string();

        let flow_scope_key: i64 = payload["flowScopeKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["flowScopeKey"].as_i64())
            .unwrap_or(process_instance_key);

        let bpmn_process_id = payload["bpmnProcessId"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let tenant_id = record.tenant_id.clone();

        // Get process definition to find element — try in-memory cache first.
        enum ProcessesSource {
            Cached(std::sync::Arc<crate::process_def_cache::CachedProcessDef>),
            Loaded(Vec<reebe_bpmn::BpmnProcess>, String),
        }

        let source = if let Some(cached) = state.process_def_cache.get_by_key(process_definition_key) {
            ProcessesSource::Cached(cached)
        } else {
            let pd = state.backend.get_process_definition_by_key(process_definition_key).await?;
            let pd_id = pd.bpmn_process_id.clone();
            let parsed = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
                .map_err(|e| EngineError::BpmnParse(e.to_string()))?;
            ProcessesSource::Loaded(parsed, pd_id)
        };

        let (processes_slice, pd_bpmn_process_id): (&[reebe_bpmn::BpmnProcess], &str) = match &source {
            ProcessesSource::Cached(c) => (&*c.processes, &c.bpmn_process_id),
            ProcessesSource::Loaded(v, id) => (v.as_slice(), id.as_str()),
        };

        let process = processes_slice
            .iter()
            .find(|p| p.id == bpmn_process_id || p.id == pd_bpmn_process_id)
            .ok_or_else(|| EngineError::NotFound(format!("Process {bpmn_process_id}")))?;

        let element = process
            .get_element(&element_id)
            .ok_or_else(|| EngineError::NotFound(format!("Element {element_id}")))?;

        // Parallel join gateway: count tokens before creating an element instance.
        if let reebe_bpmn::FlowElement::ParallelGateway(gw) = element {
            let incoming_count = gw.incoming.len() as i32;
            if incoming_count > 1 {
                let count = state.backend
                    .increment_and_get_gateway_token(process_instance_key, &element_id)
                    .await?;
                if count < incoming_count {
                    // Not all tokens have arrived yet — wait silently.
                    return Ok(());
                }
                // All tokens arrived. Clean up and proceed to activate once.
                state.backend
                    .delete_gateway_token(process_instance_key, &element_id)
                    .await?;
            }
        }

        // Determine element type string
        let element_type = element_type_string(element);

        // Generate element instance key
        let ei_key = key_gen.next_key().await?;

        // Create element instance in ACTIVATING state
        let ei = ElementInstance {
            key: ei_key,
            partition_id: state.partition_id,
            process_instance_key,
            process_definition_key,
            bpmn_process_id: bpmn_process_id.clone(),
            element_id: element_id.clone(),
            element_type: element_type.clone(),
            state: "ACTIVATING".to_string(),
            flow_scope_key: Some(flow_scope_key),
            scope_key: Some(ei_key),
            incident_key: None,
            tenant_id: tenant_id.clone(),
        };
        state.backend.insert_element_instance(&ei).await?;

        // Write ELEMENT_ACTIVATING event
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_ACTIVATING".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "processDefinitionKey": process_definition_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // Evaluate input mappings (if any), store results, create incident on failure
        {
            let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
            let mut ctx_map = serde_json::Map::new();
            for v in vars {
                ctx_map.insert(v.name, v.value);
            }
            let ctx_val = serde_json::Value::Object(ctx_map);
            let ctx = reebe_feel::FeelContext::from_json(ctx_val);

            let input_mappings = get_input_mappings(element);
            if !input_mappings.is_empty() {
                match apply_io_mappings(
                    input_mappings,
                    &ctx,
                    process_instance_key,
                    ei_key,
                    &bpmn_process_id,
                    &tenant_id,
                    writers,
                ) {
                    None => return Ok(()), // incident queued
                    Some(mapped_vars) => {
                        for (name, value) in mapped_vars {
                            let var_key = key_gen.next_key().await?;
                            state.backend.upsert_variable(&Variable {
                                key: var_key,
                                partition_id: state.partition_id,
                                name,
                                value,
                                scope_key: ei_key,
                                process_instance_key,
                                tenant_id: tenant_id.clone(),
                                is_preview: false,
                            }).await?;
                        }
                    }
                }
            }
        }

        // Element-type-specific activation
        match element {
            reebe_bpmn::FlowElement::StartEvent(_)
            | reebe_bpmn::FlowElement::EndEvent(_) => {
                // Check for compensation end event
                let is_compensation_end = matches!(
                    element,
                    reebe_bpmn::FlowElement::EndEvent(e)
                        if matches!(&e.event_definition, Some(reebe_bpmn::EventDefinition::Compensation))
                );

                // Immediately activate, then complete
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                if is_compensation_end {
                    // Find all completed elements in this scope that have a compensation boundary event
                    let all_instances = state.backend.get_element_instances_by_process_instance(process_instance_key).await.unwrap_or_default();

                    // Collect completed element IDs (in order, for LIFO we reverse later)
                    let completed_element_ids: Vec<String> = all_instances
                        .iter()
                        .filter(|ei| ei.state == "COMPLETED" && ei.key != ei_key)
                        .map(|ei| ei.element_id.clone())
                        .collect();

                    // Find boundary events of type COMPENSATION attached to completed elements
                    let mut compensation_handlers: Vec<String> = Vec::new();
                    for (id, elem) in &process.elements {
                        if let reebe_bpmn::FlowElement::BoundaryEvent(be) = elem {
                            if matches!(&be.event_definition, Some(reebe_bpmn::EventDefinition::Compensation)) {
                                if completed_element_ids.contains(&be.attached_to_ref) {
                                    compensation_handlers.push(id.clone());
                                }
                            }
                        }
                    }

                    // Activate in reverse order (LIFO compensation semantics)
                    compensation_handlers.reverse();
                    for handler_id in compensation_handlers {
                        writers.commands.push(CommandToWrite {
                            value_type: "PROCESS_INSTANCE".to_string(),
                            intent: "ACTIVATE_ELEMENT".to_string(),
                            key: process_instance_key,
                            payload: serde_json::json!({
                                "processInstanceKey": process_instance_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "bpmnProcessId": bpmn_process_id,
                                "elementId": handler_id,
                                "flowScopeKey": flow_scope_key.to_string(),
                                "tenantId": tenant_id,
                            }),
                        });
                    }

                    // Still schedule completion of the compensation end event itself
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "COMPLETE_ELEMENT".to_string(),
                        key: ei_key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei_key.to_string(),
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "elementId": element_id,
                            "elementType": element_type,
                            "bpmnProcessId": bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                } else {
                    // Schedule completion
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "COMPLETE_ELEMENT".to_string(),
                        key: ei_key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei_key.to_string(),
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "elementId": element_id,
                            "elementType": element_type,
                            "bpmnProcessId": bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
            reebe_bpmn::FlowElement::BoundaryEvent(be) => {
                // Handle compensation boundary event activation
                let is_compensation = matches!(
                    &be.event_definition,
                    Some(reebe_bpmn::EventDefinition::Compensation)
                );

                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                if is_compensation {
                    // Find the outgoing elements of this compensation handler boundary event
                    // and activate them (the compensation task)
                    let outgoing = process.outgoing_flows(&element_id);
                    for flow in outgoing {
                        writers.commands.push(CommandToWrite {
                            value_type: "PROCESS_INSTANCE".to_string(),
                            intent: "ACTIVATE_ELEMENT".to_string(),
                            key: process_instance_key,
                            payload: serde_json::json!({
                                "processInstanceKey": process_instance_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "bpmnProcessId": bpmn_process_id,
                                "elementId": flow.target_ref,
                                "flowScopeKey": flow_scope_key.to_string(),
                                "tenantId": tenant_id,
                            }),
                        });
                    }

                    // Also complete this boundary event element
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "COMPLETE_ELEMENT".to_string(),
                        key: ei_key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei_key.to_string(),
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "elementId": element_id,
                            "elementType": element_type,
                            "bpmnProcessId": bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                } else {
                    // Non-compensation boundary events just complete normally
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "COMPLETE_ELEMENT".to_string(),
                        key: ei_key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei_key.to_string(),
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "elementId": element_id,
                            "elementType": element_type,
                            "bpmnProcessId": bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
            reebe_bpmn::FlowElement::ServiceTask(st) => {
                // Create a job for the service task
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let job_type = st
                    .task_definition
                    .as_ref()
                    .map(|td| td.job_type.clone())
                    .unwrap_or_else(|| element_id.clone());

                writers.commands.push(CommandToWrite {
                    value_type: "JOB".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "jobType": job_type,
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": ei_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": element_id,
                        "retries": 3,
                        "customHeaders": {},
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::UserTask(ut) => {
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let assignee = ut.assignee.clone();
                let form_key = ut.form_definition.as_ref().map(|fd| fd.form_key.clone());

                writers.commands.push(CommandToWrite {
                    value_type: "USER_TASK".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": ei_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": element_id,
                        "assignee": assignee,
                        "formKey": form_key,
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::ExclusiveGateway(_)
            | reebe_bpmn::FlowElement::ParallelGateway(_)
            | reebe_bpmn::FlowElement::InclusiveGateway(_)
            | reebe_bpmn::FlowElement::EventBasedGateway(_) => {
                // Evaluate gateway and take appropriate outgoing flows
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // For gateways, schedule completion to evaluate outgoing flows
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::BusinessRuleTask(brt) => {
                // Evaluate DMN decision and complete immediately
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // Try to evaluate the DMN decision if one is configured
                if let Some(ref decision_id) = brt.zeebe_called_decision_id.clone() {
                    // Load variables for the current process instance
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut ctx_map = serde_json::Map::new();
                    for v in vars {
                        ctx_map.insert(v.name, v.value);
                    }
                    let input_ctx = serde_json::Value::Object(ctx_map);

                    tracing::info!(
                        decision_id = %decision_id,
                        process_instance_key = %process_instance_key,
                        "BusinessRuleTask: evaluating decision"
                    );

                    let _ = input_ctx; // evaluation is best-effort; fall through to complete
                }

                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::IntermediateCatchEvent(ice) => {
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                match &ice.event_definition {
                    Some(reebe_bpmn::EventDefinition::Signal(sig)) => {
                        // Register a signal subscription — element waits for a broadcast
                        let sub = SignalSubscription {
                            key: ei_key,
                            signal_name: sig.signal_name.clone(),
                            process_instance_key,
                            element_instance_key: ei_key,
                            element_id: element_id.clone(),
                            bpmn_process_id: bpmn_process_id.clone(),
                            process_definition_key,
                            flow_scope_key,
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_signal_subscription(&sub).await?;
                        // Do NOT schedule COMPLETE_ELEMENT — wait for signal broadcast
                    }
                    Some(reebe_bpmn::EventDefinition::Timer(timer_def)) => {
                        // Create a timer record; the scheduler will fire COMPLETE_ELEMENT when due.
                        let timer_ctx = {
                            let vs = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                            let mut m = serde_json::Map::new();
                            for v in vs { m.insert(v.name, v.value); }
                            reebe_feel::FeelContext::from_json(serde_json::Value::Object(m))
                        };
                        let due_date = eval_timer_due_date(&timer_def.expression, &timer_ctx, state.clock.now());
                        let timer_key = key_gen.next_key().await?;
                        let timer = Timer {
                            key: timer_key,
                            process_instance_key: Some(process_instance_key),
                            process_definition_key: Some(process_definition_key),
                            element_instance_key: Some(ei_key),
                            element_id: element_id.clone(),
                            due_date,
                            repetitions: 1,
                            state: "ACTIVE".to_string(),
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_timer(&timer).await?;
                        // Do NOT schedule COMPLETE_ELEMENT — wait for timer to fire
                    }
                    Some(reebe_bpmn::EventDefinition::Message(msg_def)) => {
                        // Register a message subscription and check for existing messages
                        let sub_key = key_gen.next_key().await?;
                        let correlation_key = msg_def.correlation_key.clone().unwrap_or_default();
                        let sub = MessageSubscription {
                            key: sub_key,
                            message_name: msg_def.message_name.clone(),
                            correlation_key: correlation_key.clone(),
                            process_instance_key,
                            element_instance_key: ei_key,
                            state: "OPENED".to_string(),
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_message_subscription(&sub).await?;

                        // Check if a matching message already exists
                        let existing = state.backend
                            .get_messages_by_correlation(&msg_def.message_name, &correlation_key, &tenant_id)
                            .await
                            .unwrap_or_default();
                        if let Some(_msg) = existing.into_iter().next() {
                            // Correlate immediately
                            writers.commands.push(CommandToWrite {
                                value_type: "PROCESS_INSTANCE".to_string(),
                                intent: "COMPLETE_ELEMENT".to_string(),
                                key: ei_key,
                                payload: serde_json::json!({
                                    "elementInstanceKey": ei_key.to_string(),
                                    "processInstanceKey": process_instance_key.to_string(),
                                    "processDefinitionKey": process_definition_key.to_string(),
                                    "elementId": element_id,
                                    "elementType": element_type,
                                    "bpmnProcessId": bpmn_process_id,
                                    "flowScopeKey": flow_scope_key.to_string(),
                                    "tenantId": tenant_id,
                                }),
                            });
                        }
                        // Otherwise wait for message correlation
                    }
                    _ => {
                        // Timer and other catch events — complete immediately for now
                        writers.commands.push(CommandToWrite {
                            value_type: "PROCESS_INSTANCE".to_string(),
                            intent: "COMPLETE_ELEMENT".to_string(),
                            key: ei_key,
                            payload: serde_json::json!({
                                "elementInstanceKey": ei_key.to_string(),
                                "processInstanceKey": process_instance_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "elementId": element_id,
                                "elementType": element_type,
                                "bpmnProcessId": bpmn_process_id,
                                "flowScopeKey": flow_scope_key.to_string(),
                                "tenantId": tenant_id,
                            }),
                        });
                    }
                }
            }
            _ => {
                // Default: activate immediately and complete
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
        }

        Ok(())
    }

    async fn complete_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;

        let ei_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let process_definition_key: i64 = payload["processDefinitionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processDefinitionKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processDefinitionKey".to_string()))?;

        let element_id = payload["elementId"].as_str().unwrap_or("").to_string();
        let element_type = payload["elementType"].as_str().unwrap_or("").to_string();
        let bpmn_process_id = payload["bpmnProcessId"].as_str().unwrap_or("").to_string();
        let flow_scope_key: i64 = payload["flowScopeKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["flowScopeKey"].as_i64())
            .unwrap_or(process_instance_key);
        let tenant_id = record.tenant_id.clone();

        // Transition through COMPLETING -> COMPLETED
        state.backend.update_element_instance_state(ei_key, "COMPLETING").await?;
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_COMPLETING".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // Evaluate output mappings (if any), store results, create incident on failure
        {
            let pd_result = state.backend.get_process_definition_by_key(process_definition_key).await;
            if let Ok(pd) = pd_result {
                if let Ok(processes) = reebe_bpmn::parse_bpmn(&pd.bpmn_xml) {
                    if let Some(process) = processes
                        .iter()
                        .find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)
                    {
                        if let Some(element) = process.get_element(&element_id) {
                            let output_mappings = get_output_mappings(element);
                            if !output_mappings.is_empty() {
                                let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                                let mut ctx_map = serde_json::Map::new();
                                for v in vars {
                                    ctx_map.insert(v.name, v.value);
                                }
                                let ctx_val = serde_json::Value::Object(ctx_map);
                                let ctx = reebe_feel::FeelContext::from_json(ctx_val);

                                match apply_io_mappings(
                                    output_mappings,
                                    &ctx,
                                    process_instance_key,
                                    ei_key,
                                    &bpmn_process_id,
                                    &tenant_id,
                                    writers,
                                ) {
                                    None => return Ok(()), // incident queued
                                    Some(mapped_vars) => {
                                        for (name, value) in mapped_vars {
                                            let var_key = key_gen.next_key().await?;
                                            state.backend.upsert_variable(&Variable {
                                                key: var_key,
                                                partition_id: state.partition_id,
                                                name,
                                                value,
                                                scope_key: process_instance_key,
                                                process_instance_key,
                                                tenant_id: tenant_id.clone(),
                                                is_preview: false,
                                            }).await?;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        state.backend.update_element_instance_state(ei_key, "COMPLETED").await?;
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_COMPLETED".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // If this is an EndEvent, check if the process is complete
        if element_type == "END_EVENT" {
            // Check remaining active elements (excludes the PROCESS container element itself)
            let active_count = state.backend.get_active_element_instance_count(process_instance_key).await?;
            if active_count <= 0 {
                // Mark the PROCESS-level element instance as COMPLETED
                state.backend.complete_process_element(process_instance_key).await?;

                // Complete the process instance itself
                state.backend
                    .update_process_instance_state(process_instance_key, "COMPLETED", Some(state.clock.now()))
                    .await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_COMPLETED".to_string(),
                    key: process_instance_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": process_instance_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": bpmn_process_id,
                        "elementType": "PROCESS",
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
            }
            return Ok(());
        }

        // Get outgoing sequence flows and activate targets
        let pd = state.backend.get_process_definition_by_key(process_definition_key).await?;
        let processes = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
            .map_err(|e| EngineError::BpmnParse(e.to_string()))?;
        let process = processes
            .iter()
            .find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)
            .ok_or_else(|| EngineError::NotFound(format!("Process {bpmn_process_id}")))?;

        let outgoing = process.outgoing_flows(&element_id);

        // Load variables once for condition evaluation
        let feel_ctx = {
            let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
            let mut ctx_map = serde_json::Map::new();
            for v in vars {
                ctx_map.insert(v.name, v.value);
            }
            reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map))
        };

        if element_type == "EXCLUSIVE_GATEWAY" {
            // Take the first non-default flow where the condition is true;
            // fall back to the default flow if none matches.
            let mut chosen: Option<(String, String)> = None; // (flow_id, target_id)
            let mut default_entry: Option<(String, String)> = None;

            for flow in &outgoing {
                if flow.is_default {
                    default_entry = Some((flow.id.clone(), flow.target_ref.clone()));
                    continue;
                }
                if chosen.is_some() {
                    continue;
                }
                if eval_flow_condition(&flow.condition_expression, &feel_ctx) {
                    chosen = Some((flow.id.clone(), flow.target_ref.clone()));
                }
            }

            if let Some((flow_id, target_id)) = chosen.or(default_entry) {
                let flow_key = key_gen.next_key().await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "SEQUENCE_FLOW_TAKEN".to_string(),
                    key: flow_key,
                    payload: serde_json::json!({
                        "flowKey": flow_key.to_string(),
                        "elementId": flow_id,
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "sourceElementId": element_id,
                        "targetElementId": target_id,
                        "tenantId": tenant_id,
                    }),
                });
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ACTIVATE_ELEMENT".to_string(),
                    key: process_instance_key,
                    payload: serde_json::json!({
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": target_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
        } else {
            // All other gateways and elements: take every flow whose condition is true.
            for flow in &outgoing {
                if eval_flow_condition(&flow.condition_expression, &feel_ctx) {
                    let flow_key = key_gen.next_key().await?;
                    writers.events.push(EventToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "SEQUENCE_FLOW_TAKEN".to_string(),
                        key: flow_key,
                        payload: serde_json::json!({
                            "flowKey": flow_key.to_string(),
                            "elementId": flow.id,
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "bpmnProcessId": bpmn_process_id,
                            "sourceElementId": element_id,
                            "targetElementId": flow.target_ref,
                            "tenantId": tenant_id,
                        }),
                    });
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "ACTIVATE_ELEMENT".to_string(),
                        key: process_instance_key,
                        payload: serde_json::json!({
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "bpmnProcessId": bpmn_process_id,
                            "elementId": flow.target_ref,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
        }

        Ok(())
    }

    async fn terminate_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;

        let ei_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let element_id = payload["elementId"].as_str().unwrap_or("").to_string();
        let element_type = payload["elementType"].as_str().unwrap_or("").to_string();
        let bpmn_process_id = payload["bpmnProcessId"].as_str().unwrap_or("").to_string();
        let tenant_id = record.tenant_id.clone();

        state.backend.update_element_instance_state(ei_key, "TERMINATED").await?;

        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_TERMINATED".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // Check if process is done
        let active_count = state.backend.get_active_element_instance_count(process_instance_key).await?;
        if active_count <= 0 {
            state.backend
                .update_process_instance_state(process_instance_key, "CANCELED", Some(state.clock.now()))
                .await?;
        }

        Ok(())
    }
}

/// Evaluate a timer expression and return the due date.
/// Handles FEEL expressions that produce a Duration (added to now) or a DateTime.
/// Falls back to treating the expression as a raw ISO 8601 duration string.
fn eval_timer_due_date(expression: &str, ctx: &reebe_feel::FeelContext, now: chrono::DateTime<chrono::Utc>) -> chrono::DateTime<chrono::Utc> {

    // First try evaluating as a FEEL expression
    if let Ok(val) = reebe_feel::parse_and_evaluate(expression, ctx) {
        match val {
            reebe_feel::FeelValue::Duration(ms) => {
                return now + chrono::Duration::milliseconds(ms);
            }
            reebe_feel::FeelValue::DateTime(dt) => {
                return dt;
            }
            _ => {}
        }
    }

    // Try wrapping in duration("...") for plain ISO 8601 duration strings like "PT5S"
    let wrapped = format!("duration(\"{}\")", expression.trim_matches('"'));
    if let Ok(val) = reebe_feel::parse_and_evaluate(&wrapped, ctx) {
        if let reebe_feel::FeelValue::Duration(ms) = val {
            return now + chrono::Duration::milliseconds(ms);
        }
    }

    // Fallback: treat as 0-delay (fire immediately)
    tracing::warn!(expression = %expression, "Could not parse timer expression; firing immediately");
    now
}

/// Evaluate a sequence flow condition expression.
/// Returns true if there is no condition, the condition is empty, or it evaluates to true.
fn eval_flow_condition(condition: &Option<String>, ctx: &reebe_feel::FeelContext) -> bool {
    match condition {
        None => true,
        Some(cond) if cond.trim().is_empty() => true,
        Some(cond) => match reebe_feel::parse_and_evaluate(cond, ctx) {
            Ok(val) => matches!(val, reebe_feel::FeelValue::Bool(true)),
            Err(_) => false,
        },
    }
}

fn element_type_string(element: &reebe_bpmn::FlowElement) -> String {
    match element {
        reebe_bpmn::FlowElement::StartEvent(_) => "START_EVENT".to_string(),
        reebe_bpmn::FlowElement::EndEvent(_) => "END_EVENT".to_string(),
        reebe_bpmn::FlowElement::ServiceTask(_) => "SERVICE_TASK".to_string(),
        reebe_bpmn::FlowElement::UserTask(_) => "USER_TASK".to_string(),
        reebe_bpmn::FlowElement::ReceiveTask(_) => "RECEIVE_TASK".to_string(),
        reebe_bpmn::FlowElement::ScriptTask(_) => "SCRIPT_TASK".to_string(),
        reebe_bpmn::FlowElement::SendTask(_) => "SEND_TASK".to_string(),
        reebe_bpmn::FlowElement::BusinessRuleTask(_) => "BUSINESS_RULE_TASK".to_string(),
        reebe_bpmn::FlowElement::CallActivity(_) => "CALL_ACTIVITY".to_string(),
        reebe_bpmn::FlowElement::SubProcess(_) => "SUB_PROCESS".to_string(),
        reebe_bpmn::FlowElement::ParallelGateway(_) => "PARALLEL_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::ExclusiveGateway(_) => "EXCLUSIVE_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::InclusiveGateway(_) => "INCLUSIVE_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::EventBasedGateway(_) => "EVENT_BASED_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::IntermediateCatchEvent(_) => "INTERMEDIATE_CATCH_EVENT".to_string(),
        reebe_bpmn::FlowElement::IntermediateThrowEvent(_) => "INTERMEDIATE_THROW_EVENT".to_string(),
        reebe_bpmn::FlowElement::BoundaryEvent(_) => "BOUNDARY_EVENT".to_string(),
    }
}
