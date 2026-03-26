use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct TimerProcessor;

#[async_trait]
impl RecordProcessor for TimerProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "TIMER" && intent == "TRIGGER"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let timer_key: i64 = payload["timerKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["timerKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing timerKey".to_string()))?;

        let timer = state.backend.get_timer_by_key(timer_key).await?;
        state.backend.update_timer_state(timer_key, "TRIGGERED").await?;

        writers.events.push(EventToWrite {
            value_type: "TIMER".to_string(),
            intent: "TRIGGERED".to_string(),
            key: timer_key,
            payload: serde_json::json!({
                "timerKey": timer_key.to_string(),
                "elementId": timer.element_id,
                "tenantId": tenant_id,
            }),
        });

        // If there's a waiting element instance, complete it with full metadata
        if let Some(ei_key) = timer.element_instance_key {
            let pi_key = timer.process_instance_key.unwrap_or(0);
            let pd_key = timer.process_definition_key.unwrap_or(0);

            // Load element instance to get full context
            let (element_id, element_type, bpmn_process_id, flow_scope_key) =
                if let Ok(ei) = state.backend.get_element_instance_by_key(ei_key).await {
                    (
                        ei.element_id,
                        ei.element_type,
                        ei.bpmn_process_id,
                        ei.flow_scope_key.unwrap_or(pi_key),
                    )
                } else {
                    (
                        timer.element_id.clone(),
                        "INTERMEDIATE_CATCH_EVENT".to_string(),
                        String::new(),
                        pi_key,
                    )
                };

            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "COMPLETE_ELEMENT".to_string(),
                key: ei_key,
                payload: serde_json::json!({
                    "elementInstanceKey": ei_key.to_string(),
                    "processInstanceKey": pi_key.to_string(),
                    "processDefinitionKey": pd_key.to_string(),
                    "elementId": element_id,
                    "elementType": element_type,
                    "bpmnProcessId": bpmn_process_id,
                    "flowScopeKey": flow_scope_key.to_string(),
                    "tenantId": tenant_id,
                }),
            });
        }

        Ok(())
    }
}
