use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeploymentIntent {
    Create,
    CreateComplete,
    Distribute,
    DistributeComplete,
    Distributed,
    FullyDistributed,
    Created,
}

impl fmt::Display for DeploymentIntent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Create => "CREATE",
            Self::CreateComplete => "CREATE_COMPLETE",
            Self::Distribute => "DISTRIBUTE",
            Self::DistributeComplete => "DISTRIBUTE_COMPLETE",
            Self::Distributed => "DISTRIBUTED",
            Self::FullyDistributed => "FULLY_DISTRIBUTED",
            Self::Created => "CREATED",
        };
        write!(f, "{}", s)
    }
}
