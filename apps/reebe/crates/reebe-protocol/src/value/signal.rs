use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalRecordValue {
    pub signal_name: String,
    pub variables: serde_json::Value,
    pub tenant_id: String,
}

impl SignalRecordValue {
    pub fn new(signal_name: impl Into<String>) -> Self {
        Self {
            signal_name: signal_name.into(),
            variables: serde_json::Value::Object(serde_json::Map::new()),
            tenant_id: "<default>".to_string(),
        }
    }
}
