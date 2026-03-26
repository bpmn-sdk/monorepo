use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VariableIntent {
    Create,
    Update,
    Created,
    Updated,
}

impl fmt::Display for VariableIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Update => "UPDATE",
            Self::Created => "CREATED",
            Self::Updated => "UPDATED",
        };
        write!(f, "{}", s)
    }
}
