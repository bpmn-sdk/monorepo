use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserIntent {
    Create,
    Update,
    Delete,
    Created,
    Updated,
    Deleted,
}

impl fmt::Display for UserIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Update => "UPDATE",
            Self::Delete => "DELETE",
            Self::Created => "CREATED",
            Self::Updated => "UPDATED",
            Self::Deleted => "DELETED",
        };
        write!(f, "{}", s)
    }
}
