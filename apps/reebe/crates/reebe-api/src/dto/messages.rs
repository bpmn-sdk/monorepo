use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishMessageRequest {
    pub message_name: String,
    pub correlation_key: Option<String>,
    pub time_to_live: Option<i64>,
    pub message_id: Option<String>,
    pub variables: Option<serde_json::Value>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishMessageResponse {
    pub message_key: String,
    pub tenant_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelateMessageRequest {
    pub message_name: String,
    pub correlation_key: Option<String>,
    pub variables: Option<serde_json::Value>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelateMessageResponse {
    pub message_key: String,
    pub process_instance_key: String,
    pub tenant_id: String,
}
