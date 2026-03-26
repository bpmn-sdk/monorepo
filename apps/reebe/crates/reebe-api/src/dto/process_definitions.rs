use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProcessDefinitionsRequest {
    pub filter: Option<ProcessDefinitionFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDefinitionFilter {
    pub bpmn_process_id: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDefinitionDto {
    pub process_definition_key: String,
    pub bpmn_process_id: String,
    pub version: i32,
    pub resource_name: String,
    pub tenant_id: String,
    pub deployment_key: String,
}

impl From<reebe_db::state::deployments::ProcessDefinition> for ProcessDefinitionDto {
    fn from(pd: reebe_db::state::deployments::ProcessDefinition) -> Self {
        Self {
            process_definition_key: pd.key.to_string(),
            bpmn_process_id: pd.bpmn_process_id,
            version: pd.version,
            resource_name: pd.resource_name,
            tenant_id: pd.tenant_id,
            deployment_key: pd.deployment_key.to_string(),
        }
    }
}
