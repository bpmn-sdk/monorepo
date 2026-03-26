use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchUserTasksRequest {
    pub filter: Option<UserTaskFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserTaskFilter {
    pub state: Option<String>,
    pub assignee: Option<String>,
    pub process_instance_key: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteUserTaskRequest {
    pub variables: Option<serde_json::Value>,
    pub action: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignUserTaskRequest {
    pub assignee: Option<String>,
    pub allow_override: Option<bool>,
    pub action: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserTaskDto {
    pub user_task_key: String,
    pub process_instance_key: String,
    pub element_instance_key: String,
    pub process_definition_key: String,
    pub bpmn_process_id: String,
    pub element_id: String,
    pub state: String,
    pub assignee: Option<String>,
    pub form_key: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub tenant_id: String,
}

impl From<reebe_db::state::user_tasks::UserTask> for UserTaskDto {
    fn from(t: reebe_db::state::user_tasks::UserTask) -> Self {
        Self {
            user_task_key: t.key.to_string(),
            process_instance_key: t.process_instance_key.to_string(),
            element_instance_key: t.element_instance_key.to_string(),
            process_definition_key: t.process_definition_key.to_string(),
            bpmn_process_id: t.bpmn_process_id,
            element_id: t.element_id,
            state: t.state,
            assignee: t.assignee,
            form_key: t.form_key,
            created_at: t.created_at.to_rfc3339(),
            completed_at: t.completed_at.map(|d| d.to_rfc3339()),
            tenant_id: t.tenant_id,
        }
    }
}
