use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserTaskIntent {
    Assign,
    Claim,
    Complete,
    Cancel,
    Update,
    Create,
    Created,
    Assigned,
    Claimed,
    Completed,
    Canceled,
    Updated,
    Migrate,
    Migrated,
}

impl fmt::Display for UserTaskIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Assign => "ASSIGN",
            Self::Claim => "CLAIM",
            Self::Complete => "COMPLETE",
            Self::Cancel => "CANCEL",
            Self::Update => "UPDATE",
            Self::Create => "CREATE",
            Self::Created => "CREATED",
            Self::Assigned => "ASSIGNED",
            Self::Claimed => "CLAIMED",
            Self::Completed => "COMPLETED",
            Self::Canceled => "CANCELED",
            Self::Updated => "UPDATED",
            Self::Migrate => "MIGRATE",
            Self::Migrated => "MIGRATED",
        };
        write!(f, "{}", s)
    }
}
