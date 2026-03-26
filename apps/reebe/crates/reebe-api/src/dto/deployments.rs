use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentResponse {
    pub deployment_key: String,
    pub deployments: Vec<DeployedProcess>,
    pub tenant_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployedProcess {
    pub process_definition_key: String,
    pub bpmn_process_id: String,
    pub version: i32,
    pub resource_name: String,
    pub tenant_id: String,
}
