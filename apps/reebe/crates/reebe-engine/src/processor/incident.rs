use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
#[allow(unused_imports)]
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct IncidentProcessor;

#[async_trait]
impl RecordProcessor for IncidentProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "INCIDENT" && intent == "RESOLVE"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let incident_key: i64 = payload["incidentKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["incidentKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing incidentKey".to_string()))?;

        let incident = state.backend.get_incident_by_key(incident_key).await?;
        state.backend.resolve_incident(incident_key).await?;

        writers.events.push(EventToWrite {
            value_type: "INCIDENT".to_string(),
            intent: "RESOLVED".to_string(),
            key: incident_key,
            payload: serde_json::json!({
                "incidentKey": incident_key.to_string(),
                "processInstanceKey": incident.process_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        if let Some(job_key) = incident.job_key {
            // Job incident: re-activate the job if it now has retries.
            if let Ok(job) = state.backend.get_job_by_key(job_key).await {
                if job.retries > 0 {
                    // update_retries already flips state FAILED→ACTIVATABLE when retries > 0
                    state.backend.update_job_retries(job_key, job.retries).await?;

                    writers.events.push(EventToWrite {
                        value_type: "JOB".to_string(),
                        intent: "RETRIES_UPDATED".to_string(),
                        key: job_key,
                        payload: serde_json::json!({
                            "jobKey": job_key.to_string(),
                            "retries": job.retries,
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
        } else {
            // Non-job incident (e.g. IO_MAPPING_ERROR): re-trigger element processing.
            if let Ok(ei) = state.backend.get_element_instance_by_key(incident.element_instance_key).await {
                let intent = match ei.state.as_str() {
                    "ACTIVATING" => Some("ACTIVATE_ELEMENT"),
                    "COMPLETING" => Some("COMPLETE_ELEMENT"),
                    _ => None,
                };

                if let Some(cmd_intent) = intent {
                    let flow_scope_key = ei
                        .flow_scope_key
                        .unwrap_or(ei.process_instance_key);

                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: cmd_intent.to_string(),
                        key: ei.key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei.key.to_string(),
                            "processInstanceKey": ei.process_instance_key.to_string(),
                            "processDefinitionKey": ei.process_definition_key.to_string(),
                            "elementId": ei.element_id,
                            "elementType": ei.element_type,
                            "bpmnProcessId": ei.bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
        }

        writers.response = Some(serde_json::json!({
            "incidentKey": incident_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
