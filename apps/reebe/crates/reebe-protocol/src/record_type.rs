use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecordType {
    Command,
    Event,
    Rejection,
}

impl fmt::Display for RecordType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RecordType::Command => write!(f, "COMMAND"),
            RecordType::Event => write!(f, "EVENT"),
            RecordType::Rejection => write!(f, "REJECTION"),
        }
    }
}

impl TryFrom<&str> for RecordType {
    type Error = crate::error::ProtocolError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "COMMAND" => Ok(RecordType::Command),
            "EVENT" => Ok(RecordType::Event),
            "REJECTION" => Ok(RecordType::Rejection),
            other => Err(crate::error::ProtocolError::InvalidRecordType(
                other.to_string(),
            )),
        }
    }
}
