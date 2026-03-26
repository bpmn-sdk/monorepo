use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobIntent {
    Create,
    Activate,
    Complete,
    Fail,
    ThrowError,
    Cancel,
    RecurAfterBackoff,
    Timeout,
    UpdateRetries,
    Yield,
    Created,
    Activated,
    Completed,
    Failed,
    ErrorThrown,
    Canceled,
    TimedOut,
    RetriesUpdated,
}

impl fmt::Display for JobIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Activate => "ACTIVATE",
            Self::Complete => "COMPLETE",
            Self::Fail => "FAIL",
            Self::ThrowError => "THROW_ERROR",
            Self::Cancel => "CANCEL",
            Self::RecurAfterBackoff => "RECUR_AFTER_BACKOFF",
            Self::Timeout => "TIMEOUT",
            Self::UpdateRetries => "UPDATE_RETRIES",
            Self::Yield => "YIELD",
            Self::Created => "CREATED",
            Self::Activated => "ACTIVATED",
            Self::Completed => "COMPLETED",
            Self::Failed => "FAILED",
            Self::ErrorThrown => "ERROR_THROWN",
            Self::Canceled => "CANCELED",
            Self::TimedOut => "TIMED_OUT",
            Self::RetriesUpdated => "RETRIES_UPDATED",
        };
        write!(f, "{}", s)
    }
}
