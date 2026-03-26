use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::EngineResult;
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct SignalProcessor;

#[async_trait]
impl RecordProcessor for SignalProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "SIGNAL" && intent == "BROADCAST"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let signal_key = key_gen.next_key().await?;
        let signal_name = payload["signalName"].as_str().unwrap_or("").to_string();
        let variables = payload.get("variables").cloned()
            .unwrap_or_else(|| serde_json::Value::Object(Default::default()));

        writers.events.push(EventToWrite {
            value_type: "SIGNAL".to_string(),
            intent: "BROADCASTED".to_string(),
            key: signal_key,
            payload: serde_json::json!({
                "signalKey": signal_key.to_string(),
                "signalName": signal_name,
                "variables": variables,
                "tenantId": tenant_id,
            }),
        });

        // Activate all waiting signal catch events
        let subscriptions = state.backend
            .get_signal_subscriptions_by_name(&signal_name, &tenant_id)
            .await
            .unwrap_or_default();

        for sub in subscriptions {
            // Delete the subscription — it's consumed
            let _ = state.backend.delete_signal_subscription(sub.key).await;

            // Complete the waiting catch event element
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "COMPLETE_ELEMENT".to_string(),
                key: sub.element_instance_key,
                payload: serde_json::json!({
                    "elementInstanceKey": sub.element_instance_key.to_string(),
                    "processInstanceKey": sub.process_instance_key.to_string(),
                    "processDefinitionKey": sub.process_definition_key.to_string(),
                    "elementId": sub.element_id,
                    "elementType": "INTERMEDIATE_CATCH_EVENT",
                    "bpmnProcessId": sub.bpmn_process_id,
                    "flowScopeKey": sub.flow_scope_key.to_string(),
                    "tenantId": tenant_id,
                    "variables": variables,
                }),
            });
        }

        writers.response = Some(serde_json::json!({
            "signalKey": signal_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
