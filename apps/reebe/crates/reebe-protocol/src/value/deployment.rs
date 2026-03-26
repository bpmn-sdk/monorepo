use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentRecordValue {
    pub resources: Vec<DeploymentResource>,
    pub process_metadata_records: Vec<ProcessMetadata>,
    pub decision_metadata_records: Vec<DecisionMetadata>,
    pub decision_requirements_metadata_records: Vec<DecisionRequirementsMetadata>,
    pub form_metadata_records: Vec<FormMetadata>,
    pub tenant_id: String,
}

impl DeploymentRecordValue {
    pub fn new(tenant_id: impl Into<String>) -> Self {
        Self {
            resources: Vec::new(),
            process_metadata_records: Vec::new(),
            decision_metadata_records: Vec::new(),
            decision_requirements_metadata_records: Vec::new(),
            form_metadata_records: Vec::new(),
            tenant_id: tenant_id.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentResource {
    pub resource: Vec<u8>,
    pub resource_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMetadata {
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub version: i32,
    pub resource_name: String,
    pub checksum: Vec<u8>,
    pub tenant_id: String,
    pub is_duplicate: bool,
    pub deployment_key: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionMetadata {
    pub decision_key: i64,
    pub dmn_decision_id: String,
    pub dmn_decision_name: String,
    pub version: i32,
    pub decision_requirements_key: i64,
    pub dmn_decision_requirements_id: String,
    pub resource_name: String,
    pub checksum: Vec<u8>,
    pub tenant_id: String,
    pub is_duplicate: bool,
    pub deployment_key: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionRequirementsMetadata {
    pub decision_requirements_key: i64,
    pub dmn_decision_requirements_id: String,
    pub dmn_decision_requirements_name: String,
    pub version: i32,
    pub namespace: String,
    pub resource_name: String,
    pub checksum: Vec<u8>,
    pub tenant_id: String,
    pub is_duplicate: bool,
    pub deployment_key: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormMetadata {
    pub form_key: i64,
    pub form_id: String,
    pub version: i64,
    pub resource_name: String,
    pub checksum: Vec<u8>,
    pub tenant_id: String,
    pub is_duplicate: bool,
    pub deployment_key: i64,
}
