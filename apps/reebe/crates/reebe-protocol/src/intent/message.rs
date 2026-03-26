use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MessageIntent {
    Publish,
    Published,
    Delete,
    Deleted,
    Expire,
    Expired,
}

impl fmt::Display for MessageIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Publish => "PUBLISH",
            Self::Published => "PUBLISHED",
            Self::Delete => "DELETE",
            Self::Deleted => "DELETED",
            Self::Expire => "EXPIRE",
            Self::Expired => "EXPIRED",
        };
        write!(f, "{}", s)
    }
}
