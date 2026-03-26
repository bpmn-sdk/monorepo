use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MappingRuleIntent {
    Create,
    Delete,
    Created,
    Deleted,
}

impl fmt::Display for MappingRuleIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Delete => "DELETE",
            Self::Created => "CREATED",
            Self::Deleted => "DELETED",
        };
        write!(f, "{}", s)
    }
}
