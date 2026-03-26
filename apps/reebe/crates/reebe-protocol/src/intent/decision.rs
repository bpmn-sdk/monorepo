use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DecisionIntent {
    Create,
    Created,
    Delete,
    Deleted,
}

impl fmt::Display for DecisionIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Created => "CREATED",
            Self::Delete => "DELETE",
            Self::Deleted => "DELETED",
        };
        write!(f, "{}", s)
    }
}
