use argon2::{Argon2, PasswordHash, PasswordVerifier};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
};
use reebe_db::DbPool;
use reebe_db::state::identity::UserRepository;

use super::{AuthError, AuthenticatedUser};

/// Validate an HTTP Basic auth credential string (base64-encoded `username:password`)
/// against the local user database.
pub async fn validate_basic(pool: &DbPool, credentials: &str) -> Result<AuthenticatedUser, AuthError> {
    use base64::Engine;

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(credentials)
        .map_err(|_| AuthError::InvalidHeader)?;

    let decoded_str =
        std::str::from_utf8(&decoded).map_err(|_| AuthError::InvalidHeader)?;

    let (username, password) = decoded_str
        .split_once(':')
        .ok_or(AuthError::InvalidHeader)?;

    let repo = UserRepository::new(pool);
    let user = repo
        .get_by_username(username)
        .await
        .map_err(|_| AuthError::UserNotFound)?;

    let hash = user.password_hash.ok_or(AuthError::InvalidCredentials)?;

    // argon2 verification is CPU-intensive; run on a blocking thread.
    let password_owned = password.to_string();
    tokio::task::spawn_blocking(move || verify_password(&password_owned, &hash))
        .await
        .map_err(|e| AuthError::Internal(e.to_string()))??;

    Ok(AuthenticatedUser {
        username: username.to_string(),
        groups: vec![],
    })
}

pub fn verify_password(password: &str, hash: &str) -> Result<(), AuthError> {
    let parsed_hash = PasswordHash::new(hash).map_err(|_| AuthError::InvalidCredentials)?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| AuthError::InvalidCredentials)
}

/// Hash a plaintext password using Argon2id. CPU-intensive — call from a blocking thread.
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AuthError::Internal(e.to_string()))
}
