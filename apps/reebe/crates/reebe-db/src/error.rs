use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[cfg(any(feature = "postgres", feature = "sqlite"))]
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Record not found: {0}")]
    NotFound(String),
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
