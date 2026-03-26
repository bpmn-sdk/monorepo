use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProcessInstanceIntent {
    ActivateElement,
    CompleteElement,
    TerminateElement,
    Cancel,
    ElementActivating,
    ElementActivated,
    ElementCompleting,
    ElementCompleted,
    ElementTerminating,
    ElementTerminated,
    SequenceFlowTaken,
    CancelProcessing,
    Migrate,
}

impl fmt::Display for ProcessInstanceIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::ActivateElement => "ACTIVATE_ELEMENT",
            Self::CompleteElement => "COMPLETE_ELEMENT",
            Self::TerminateElement => "TERMINATE_ELEMENT",
            Self::Cancel => "CANCEL",
            Self::ElementActivating => "ELEMENT_ACTIVATING",
            Self::ElementActivated => "ELEMENT_ACTIVATED",
            Self::ElementCompleting => "ELEMENT_COMPLETING",
            Self::ElementCompleted => "ELEMENT_COMPLETED",
            Self::ElementTerminating => "ELEMENT_TERMINATING",
            Self::ElementTerminated => "ELEMENT_TERMINATED",
            Self::SequenceFlowTaken => "SEQUENCE_FLOW_TAKEN",
            Self::CancelProcessing => "CANCEL_PROCESSING",
            Self::Migrate => "MIGRATE",
        };
        write!(f, "{}", s)
    }
}
