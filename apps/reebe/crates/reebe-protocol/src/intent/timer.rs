use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TimerIntent {
    Create,
    Trigger,
    Cancel,
    Created,
    Triggered,
    Canceled,
}

impl fmt::Display for TimerIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Trigger => "TRIGGER",
            Self::Cancel => "CANCEL",
            Self::Created => "CREATED",
            Self::Triggered => "TRIGGERED",
            Self::Canceled => "CANCELED",
        };
        write!(f, "{}", s)
    }
}
