use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SignalIntent {
    Broadcast,
    Broadcasted,
}

impl fmt::Display for SignalIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Broadcast => "BROADCAST",
            Self::Broadcasted => "BROADCASTED",
        };
        write!(f, "{}", s)
    }
}
