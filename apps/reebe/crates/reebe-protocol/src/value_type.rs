use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ValueType {
    Deployment,
    Process,
    ProcessInstance,
    ProcessInstanceCreation,
    ProcessInstanceMigration,
    ProcessInstanceModification,
    ProcessMessageSubscription,
    Job,
    JobBatch,
    Message,
    MessageSubscription,
    MessageStartEventSubscription,
    Incident,
    Variable,
    VariableDocument,
    UserTask,
    Signal,
    Decision,
    DecisionRequirements,
    DecisionEvaluation,
    Timer,
    Error,
    Escalation,
    CompensationSubscription,
    User,
    Tenant,
    Role,
    Group,
    Authorization,
    MappingRule,
    Form,
    Resource,
    ClockRecord,
}

impl fmt::Display for ValueType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ValueType::Deployment => "DEPLOYMENT",
            ValueType::Process => "PROCESS",
            ValueType::ProcessInstance => "PROCESS_INSTANCE",
            ValueType::ProcessInstanceCreation => "PROCESS_INSTANCE_CREATION",
            ValueType::ProcessInstanceMigration => "PROCESS_INSTANCE_MIGRATION",
            ValueType::ProcessInstanceModification => "PROCESS_INSTANCE_MODIFICATION",
            ValueType::ProcessMessageSubscription => "PROCESS_MESSAGE_SUBSCRIPTION",
            ValueType::Job => "JOB",
            ValueType::JobBatch => "JOB_BATCH",
            ValueType::Message => "MESSAGE",
            ValueType::MessageSubscription => "MESSAGE_SUBSCRIPTION",
            ValueType::MessageStartEventSubscription => "MESSAGE_START_EVENT_SUBSCRIPTION",
            ValueType::Incident => "INCIDENT",
            ValueType::Variable => "VARIABLE",
            ValueType::VariableDocument => "VARIABLE_DOCUMENT",
            ValueType::UserTask => "USER_TASK",
            ValueType::Signal => "SIGNAL",
            ValueType::Decision => "DECISION",
            ValueType::DecisionRequirements => "DECISION_REQUIREMENTS",
            ValueType::DecisionEvaluation => "DECISION_EVALUATION",
            ValueType::Timer => "TIMER",
            ValueType::Error => "ERROR",
            ValueType::Escalation => "ESCALATION",
            ValueType::CompensationSubscription => "COMPENSATION_SUBSCRIPTION",
            ValueType::User => "USER",
            ValueType::Tenant => "TENANT",
            ValueType::Role => "ROLE",
            ValueType::Group => "GROUP",
            ValueType::Authorization => "AUTHORIZATION",
            ValueType::MappingRule => "MAPPING_RULE",
            ValueType::Form => "FORM",
            ValueType::Resource => "RESOURCE",
            ValueType::ClockRecord => "CLOCK_RECORD",
        };
        write!(f, "{}", s)
    }
}

impl TryFrom<&str> for ValueType {
    type Error = crate::error::ProtocolError;

    fn try_from(s: &str) -> Result<Self, crate::error::ProtocolError> {
        match s {
            "DEPLOYMENT" => Ok(ValueType::Deployment),
            "PROCESS" => Ok(ValueType::Process),
            "PROCESS_INSTANCE" => Ok(ValueType::ProcessInstance),
            "PROCESS_INSTANCE_CREATION" => Ok(ValueType::ProcessInstanceCreation),
            "PROCESS_INSTANCE_MIGRATION" => Ok(ValueType::ProcessInstanceMigration),
            "PROCESS_INSTANCE_MODIFICATION" => Ok(ValueType::ProcessInstanceModification),
            "PROCESS_MESSAGE_SUBSCRIPTION" => Ok(ValueType::ProcessMessageSubscription),
            "JOB" => Ok(ValueType::Job),
            "JOB_BATCH" => Ok(ValueType::JobBatch),
            "MESSAGE" => Ok(ValueType::Message),
            "MESSAGE_SUBSCRIPTION" => Ok(ValueType::MessageSubscription),
            "MESSAGE_START_EVENT_SUBSCRIPTION" => Ok(ValueType::MessageStartEventSubscription),
            "INCIDENT" => Ok(ValueType::Incident),
            "VARIABLE" => Ok(ValueType::Variable),
            "VARIABLE_DOCUMENT" => Ok(ValueType::VariableDocument),
            "USER_TASK" => Ok(ValueType::UserTask),
            "SIGNAL" => Ok(ValueType::Signal),
            "DECISION" => Ok(ValueType::Decision),
            "DECISION_REQUIREMENTS" => Ok(ValueType::DecisionRequirements),
            "DECISION_EVALUATION" => Ok(ValueType::DecisionEvaluation),
            "TIMER" => Ok(ValueType::Timer),
            "ERROR" => Ok(ValueType::Error),
            "ESCALATION" => Ok(ValueType::Escalation),
            "COMPENSATION_SUBSCRIPTION" => Ok(ValueType::CompensationSubscription),
            "USER" => Ok(ValueType::User),
            "TENANT" => Ok(ValueType::Tenant),
            "ROLE" => Ok(ValueType::Role),
            "GROUP" => Ok(ValueType::Group),
            "AUTHORIZATION" => Ok(ValueType::Authorization),
            "MAPPING_RULE" => Ok(ValueType::MappingRule),
            "FORM" => Ok(ValueType::Form),
            "RESOURCE" => Ok(ValueType::Resource),
            "CLOCK_RECORD" => Ok(ValueType::ClockRecord),
            other => Err(crate::error::ProtocolError::InvalidValueType(
                other.to_string(),
            )),
        }
    }
}
