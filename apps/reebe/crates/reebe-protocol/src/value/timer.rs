use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerRecordValue {
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub element_instance_key: i64,
    pub target_element_id: String,
    pub due_date: i64,
    pub repetitions: i32,
    pub tenant_id: String,
}

impl TimerRecordValue {
    pub fn new(
        process_instance_key: i64,
        process_definition_key: i64,
        element_instance_key: i64,
        target_element_id: impl Into<String>,
        due_date: i64,
        repetitions: i32,
    ) -> Self {
        Self {
            process_instance_key,
            process_definition_key,
            element_instance_key,
            target_element_id: target_element_id.into(),
            due_date,
            repetitions,
            tenant_id: "<default>".to_string(),
        }
    }
}
