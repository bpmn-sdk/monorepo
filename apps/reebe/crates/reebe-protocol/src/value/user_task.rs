use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserTaskRecordValue {
    pub user_task_key: i64,
    pub assignee: Option<String>,
    pub candidate_groups: Vec<String>,
    pub candidate_users: Vec<String>,
    pub due_date: Option<String>,
    pub follow_up_date: Option<String>,
    pub form_key: Option<i64>,
    pub form_id: Option<String>,
    pub form_version: Option<i64>,
    pub is_form_linked: bool,
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub element_instance_key: i64,
    pub element_id: String,
    pub bpmn_process_id: String,
    pub process_definition_version: i32,
    pub variables: serde_json::Value,
    pub tenant_id: String,
    pub creation_timestamp: i64,
    pub action: String,
    pub changed_attributes: Vec<String>,
    pub priority: i32,
}

impl UserTaskRecordValue {
    pub fn new(
        user_task_key: i64,
        process_instance_key: i64,
        element_instance_key: i64,
        element_id: impl Into<String>,
        bpmn_process_id: impl Into<String>,
        process_definition_key: i64,
    ) -> Self {
        Self {
            user_task_key,
            assignee: None,
            candidate_groups: Vec::new(),
            candidate_users: Vec::new(),
            due_date: None,
            follow_up_date: None,
            form_key: None,
            form_id: None,
            form_version: None,
            is_form_linked: false,
            process_instance_key,
            process_definition_key,
            element_instance_key,
            element_id: element_id.into(),
            bpmn_process_id: bpmn_process_id.into(),
            process_definition_version: 1,
            variables: serde_json::Value::Object(serde_json::Map::new()),
            tenant_id: "<default>".to_string(),
            creation_timestamp: chrono::Utc::now().timestamp_millis(),
            action: String::new(),
            changed_attributes: Vec::new(),
            priority: 50,
        }
    }
}
