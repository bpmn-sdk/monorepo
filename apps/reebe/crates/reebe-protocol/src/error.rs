use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("Invalid record type: {0}")]
    InvalidRecordType(String),

    #[error("Invalid value type: {0}")]
    InvalidValueType(String),

    #[error("Invalid intent: {0}")]
    InvalidIntent(String),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Invalid key: {0}")]
    InvalidKey(i64),
}
