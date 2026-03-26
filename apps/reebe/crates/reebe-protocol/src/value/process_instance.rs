use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInstanceRecordValue {
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub version: i32,
    pub process_instance_key: i64,
    pub element_id: String,
    /// The BPMN element type: "PROCESS", "SERVICE_TASK", "USER_TASK", etc.
    pub bpmn_element_type: String,
    pub parent_process_instance_key: Option<i64>,
    pub parent_element_instance_key: Option<i64>,
    pub variables: serde_json::Value,
    pub tenant_id: String,
    pub flow_scope_key: Option<i64>,
}

impl ProcessInstanceRecordValue {
    pub fn new(
        process_definition_key: i64,
        bpmn_process_id: impl Into<String>,
        version: i32,
        process_instance_key: i64,
        element_id: impl Into<String>,
        bpmn_element_type: impl Into<String>,
    ) -> Self {
        Self {
            process_definition_key,
            bpmn_process_id: bpmn_process_id.into(),
            version,
            process_instance_key,
            element_id: element_id.into(),
            bpmn_element_type: bpmn_element_type.into(),
            parent_process_instance_key: None,
            parent_element_instance_key: None,
            variables: serde_json::Value::Object(serde_json::Map::new()),
            tenant_id: "<default>".to_string(),
            flow_scope_key: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serde_roundtrip() {
        let val = ProcessInstanceRecordValue::new(
            1234,
            "my-process",
            1,
            5678,
            "StartEvent_1",
            "START_EVENT",
        );
        let json = serde_json::to_string(&val).unwrap();
        let restored: ProcessInstanceRecordValue = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.bpmn_process_id, val.bpmn_process_id);
        assert_eq!(restored.element_id, val.element_id);
    }
}
