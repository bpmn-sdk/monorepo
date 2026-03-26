use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProcessInstanceRequest {
    pub bpmn_process_id: Option<String>,
    pub process_definition_key: Option<String>,
    pub version: Option<i32>,
    pub variables: Option<serde_json::Value>,
    pub tenant_id: Option<String>,
    pub start_instructions: Option<Vec<serde_json::Value>>,
    pub operation_reference: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProcessInstanceResponse {
    pub process_instance_key: String,
    pub process_definition_key: String,
    pub bpmn_process_id: String,
    pub version: i32,
    pub tenant_id: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProcessInstancesRequest {
    pub filter: Option<ProcessInstanceFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInstanceFilter {
    pub state: Option<String>,
    pub bpmn_process_id: Option<String>,
    pub process_instance_key: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInstanceDto {
    pub process_instance_key: String,
    pub process_definition_key: String,
    pub bpmn_process_id: String,
    pub version: i32,
    pub state: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub tenant_id: String,
}

impl From<reebe_db::state::process_instances::ProcessInstance> for ProcessInstanceDto {
    fn from(pi: reebe_db::state::process_instances::ProcessInstance) -> Self {
        Self {
            process_instance_key: pi.key.to_string(),
            process_definition_key: pi.process_definition_key.to_string(),
            bpmn_process_id: pi.bpmn_process_id,
            version: pi.version,
            state: pi.state,
            start_date: pi.start_date.to_rfc3339(),
            end_date: pi.end_date.map(|d| d.to_rfc3339()),
            tenant_id: pi.tenant_id,
        }
    }
}
