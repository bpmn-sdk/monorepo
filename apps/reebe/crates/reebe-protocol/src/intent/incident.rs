use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IncidentIntent {
    Create,
    Resolve,
    Created,
    Resolved,
}

impl fmt::Display for IncidentIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Resolve => "RESOLVE",
            Self::Created => "CREATED",
            Self::Resolved => "RESOLVED",
        };
        write!(f, "{}", s)
    }
}
