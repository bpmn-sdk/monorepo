use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncidentRecordValue {
    pub error_type: IncidentErrorType,
    pub error_message: String,
    pub bpmn_process_id: String,
    pub process_definition_key: i64,
    pub process_instance_key: i64,
    pub element_id: String,
    pub element_instance_key: i64,
    pub job_key: Option<i64>,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IncidentErrorType {
    UnhandledErrorEvent,
    JobNoRetries,
    ConditionError,
    ExtractionError,
    IoMappingError,
    JobWorkerTaskListenerNoRetries,
    Unknown,
    MessageSizeExceeded,
    CalledElementError,
    UnresolvableSubscription,
    FormNotFound,
}
