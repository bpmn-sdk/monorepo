use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchVariablesRequest {
    pub filter: Option<VariableFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableFilter {
    pub scope_key: Option<String>,
    pub process_instance_key: Option<String>,
    pub name: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableDto {
    pub variable_key: String,
    pub name: String,
    pub value: String,
    pub scope_key: String,
    pub process_instance_key: String,
    pub tenant_id: String,
}

impl From<reebe_db::state::variables::Variable> for VariableDto {
    fn from(v: reebe_db::state::variables::Variable) -> Self {
        Self {
            variable_key: v.key.to_string(),
            name: v.name,
            value: v.value.to_string(),
            scope_key: v.scope_key.to_string(),
            process_instance_key: v.process_instance_key.to_string(),
            tenant_id: v.tenant_id,
        }
    }
}
