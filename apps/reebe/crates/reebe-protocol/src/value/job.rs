use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecordValue {
    pub job_type: String,
    pub worker: String,
    pub retries: i32,
    pub deadline: i64,
    pub error_message: Option<String>,
    pub error_code: Option<String>,
    pub custom_headers: serde_json::Value,
    pub variables: serde_json::Value,
    pub process_instance_key: i64,
    pub element_id: String,
    pub element_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub process_definition_version: i32,
    pub tenant_id: String,
    pub retry_backoff_ms: i64,
    pub timeout: i64,
}

impl JobRecordValue {
    pub fn new(
        job_type: impl Into<String>,
        process_instance_key: i64,
        element_id: impl Into<String>,
        element_instance_key: i64,
        process_definition_key: i64,
        bpmn_process_id: impl Into<String>,
    ) -> Self {
        Self {
            job_type: job_type.into(),
            worker: String::new(),
            retries: 3,
            deadline: -1,
            error_message: None,
            error_code: None,
            custom_headers: serde_json::Value::Object(serde_json::Map::new()),
            variables: serde_json::Value::Object(serde_json::Map::new()),
            process_instance_key,
            element_id: element_id.into(),
            element_instance_key,
            process_definition_key,
            bpmn_process_id: bpmn_process_id.into(),
            process_definition_version: 1,
            tenant_id: "<default>".to_string(),
            retry_backoff_ms: 0,
            timeout: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serde_roundtrip() {
        let val = JobRecordValue::new("my-job", 1, "ServiceTask_1", 2, 3, "my-process");
        let json = serde_json::to_string(&val).unwrap();
        let restored: JobRecordValue = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.job_type, val.job_type);
        assert_eq!(restored.retries, 3);
    }
}
