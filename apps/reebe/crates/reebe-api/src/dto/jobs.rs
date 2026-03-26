use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateJobsRequest {
    #[serde(rename = "type")]
    pub job_type: String,
    pub timeout: i64,
    pub max_jobs_to_activate: i32,
    pub worker: Option<String>,
    pub request_timeout: Option<i64>,
    pub fetch_variable: Option<Vec<String>>,
    pub tenant_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateJobsResponse {
    pub jobs: Vec<ActivatedJob>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivatedJob {
    pub job_key: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub process_instance_key: String,
    pub element_instance_key: String,
    pub process_definition_key: String,
    pub process_definition_id: String,
    pub process_definition_version: i32,
    pub element_id: String,
    pub retries: i32,
    pub deadline: i64,
    pub worker: String,
    pub custom_headers: serde_json::Value,
    pub variables: serde_json::Value,
    pub tenant_id: String,
    pub kind: String,
    pub listener_event_type: Option<String>,
    pub root_process_instance_key: Option<String>,
}

impl From<reebe_db::state::jobs::Job> for ActivatedJob {
    fn from(job: reebe_db::state::jobs::Job) -> Self {
        let deadline = job
            .deadline
            .map(|d| d.timestamp_millis())
            .unwrap_or(0);
        Self {
            job_key: job.key.to_string(),
            job_type: job.job_type,
            process_instance_key: job.process_instance_key.to_string(),
            element_instance_key: job.element_instance_key.to_string(),
            process_definition_key: job.process_definition_key.to_string(),
            process_definition_id: job.bpmn_process_id,
            process_definition_version: 0,
            element_id: job.element_id,
            retries: job.retries,
            deadline,
            worker: job.worker.unwrap_or_default(),
            custom_headers: job.custom_headers,
            variables: job.variables,
            tenant_id: job.tenant_id,
            kind: "BPMN_ELEMENT".to_string(),
            listener_event_type: None,
            root_process_instance_key: None,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteJobRequest {
    pub variables: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailJobRequest {
    pub retries: i32,
    pub error_message: Option<String>,
    pub retry_back_off: Option<i64>,
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThrowErrorRequest {
    pub error_code: String,
    pub error_message: Option<String>,
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchJobsRequest {
    pub filter: Option<JobFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFilter {
    pub state: Option<String>,
    pub job_type: Option<String>,
    pub process_instance_key: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobDto {
    pub job_key: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub state: String,
    pub process_instance_key: String,
    pub element_instance_key: String,
    pub process_definition_key: String,
    pub process_definition_id: String,
    pub element_id: String,
    pub retries: i32,
    pub worker: String,
    pub deadline: Option<String>,
    pub tenant_id: String,
    pub kind: String,
    pub listener_event_type: Option<String>,
    pub root_process_instance_key: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub custom_headers: serde_json::Value,
}

impl From<reebe_db::state::jobs::Job> for JobDto {
    fn from(job: reebe_db::state::jobs::Job) -> Self {
        Self {
            job_key: job.key.to_string(),
            job_type: job.job_type,
            state: job.state,
            process_instance_key: job.process_instance_key.to_string(),
            element_instance_key: job.element_instance_key.to_string(),
            process_definition_key: job.process_definition_key.to_string(),
            process_definition_id: job.bpmn_process_id,
            element_id: job.element_id,
            retries: job.retries,
            worker: job.worker.unwrap_or_default(),
            deadline: job.deadline.map(|d| d.to_rfc3339()),
            tenant_id: job.tenant_id,
            kind: "BPMN_ELEMENT".to_string(),
            listener_event_type: None,
            root_process_instance_key: None,
            error_code: job.error_code,
            error_message: job.error_message,
            custom_headers: job.custom_headers,
        }
    }
}
