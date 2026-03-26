use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TenantIntent {
    Create,
    Update,
    Delete,
    AddEntity,
    RemoveEntity,
    Created,
    Updated,
    Deleted,
    EntityAdded,
    EntityRemoved,
}

impl fmt::Display for TenantIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::Update => "UPDATE",
            Self::Delete => "DELETE",
            Self::AddEntity => "ADD_ENTITY",
            Self::RemoveEntity => "REMOVE_ENTITY",
            Self::Created => "CREATED",
            Self::Updated => "UPDATED",
            Self::Deleted => "DELETED",
            Self::EntityAdded => "ENTITY_ADDED",
            Self::EntityRemoved => "ENTITY_REMOVED",
        };
        write!(f, "{}", s)
    }
}
