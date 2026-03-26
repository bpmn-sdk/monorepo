use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchIncidentsRequest {
    pub filter: Option<IncidentFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncidentFilter {
    pub state: Option<String>,
    pub error_type: Option<String>,
    pub process_instance_key: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncidentDto {
    pub incident_key: String,
    pub process_instance_key: String,
    pub process_definition_key: String,
    pub element_instance_key: String,
    pub element_id: String,
    pub error_type: String,
    pub error_message: Option<String>,
    pub state: String,
    pub job_key: Option<String>,
    pub created_at: String,
    pub resolved_at: Option<String>,
    pub tenant_id: String,
}

impl From<reebe_db::state::incidents::Incident> for IncidentDto {
    fn from(i: reebe_db::state::incidents::Incident) -> Self {
        Self {
            incident_key: i.key.to_string(),
            process_instance_key: i.process_instance_key.to_string(),
            process_definition_key: i.process_definition_key.to_string(),
            element_instance_key: i.element_instance_key.to_string(),
            element_id: i.element_id,
            error_type: i.error_type,
            error_message: i.error_message,
            state: i.state,
            job_key: i.job_key.map(|k| k.to_string()),
            created_at: i.created_at.to_rfc3339(),
            resolved_at: i.resolved_at.map(|d| d.to_rfc3339()),
            tenant_id: i.tenant_id,
        }
    }
}
