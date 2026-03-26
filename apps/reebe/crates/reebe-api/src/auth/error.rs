use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing Authorization header")]
    MissingHeader,

    #[error("invalid Authorization header format")]
    InvalidHeader,

    #[error("token is expired or invalid: {0}")]
    InvalidToken(String),

    #[error("failed to fetch JWKS: {0}")]
    JwksFetch(String),

    #[error("no matching signing key found for token")]
    KeyNotFound,

    #[error("invalid credentials")]
    InvalidCredentials,

    #[error("user not found")]
    UserNotFound,

    #[error("internal auth error: {0}")]
    Internal(String),
}
