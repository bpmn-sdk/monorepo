use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRecordValue {
    pub name: String,
    pub correlation_key: String,
    pub time_to_live: i64,
    pub message_id: String,
    pub variables: serde_json::Value,
    pub tenant_id: String,
    pub deadline: i64,
}

impl MessageRecordValue {
    pub fn new(
        name: impl Into<String>,
        correlation_key: impl Into<String>,
        time_to_live: i64,
        message_id: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            correlation_key: correlation_key.into(),
            time_to_live,
            message_id: message_id.into(),
            variables: serde_json::Value::Object(serde_json::Map::new()),
            tenant_id: "<default>".to_string(),
            deadline: -1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSubscriptionRecordValue {
    pub process_instance_key: i64,
    pub element_instance_key: i64,
    pub bpmn_process_id: String,
    pub message_key: i64,
    pub message_name: String,
    pub correlation_key: String,
    pub is_opening: bool,
    pub is_closing: bool,
    pub variables: serde_json::Value,
    pub tenant_id: String,
}
