use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSignalRequest {
    pub signal_name: String,
    pub variables: Option<serde_json::Value>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSignalResponse {
    pub signal_key: String,
    pub tenant_id: String,
}
