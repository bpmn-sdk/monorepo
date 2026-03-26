use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tracing::warn;

use reebe_db::DbPool;

use super::{
    basic::validate_basic, AuthConfig, AuthError, AuthMethod, JwksClient,
};

/// Shared state for the auth middleware, held in an `Arc`.
pub struct AuthState {
    pub config: AuthConfig,
    /// OIDC JWKS client — present only when `method = oidc` and `enabled = true`.
    pub jwks_client: Option<Arc<JwksClient>>,
    /// DB pool for Basic auth user lookups — present only when `method = basic` and `enabled = true`.
    pub pool: Option<DbPool>,
}

impl AuthState {
    /// Build auth state, pre-fetching JWKS if OIDC is enabled.
    pub async fn new(config: AuthConfig, pool: DbPool) -> Self {
        if !config.enabled {
            return Self {
                config,
                jwks_client: None,
                pool: None,
            };
        }

        match &config.method {
            AuthMethod::Oidc => {
                let client = JwksClient::new(config.oidc.clone()).await;
                Self {
                    config,
                    jwks_client: Some(Arc::new(client)),
                    pool: None,
                }
            }
            AuthMethod::Basic => Self {
                config,
                jwks_client: None,
                pool: Some(pool),
            },
        }
    }
}

/// Axum middleware that enforces authentication when `auth.enabled = true`.
///
/// On success, injects [`AuthenticatedUser`] into request extensions.
/// On failure, returns `401 Unauthorized` with an RFC 7807 body.
pub async fn auth_middleware(
    State(auth_state): State<Arc<AuthState>>,
    mut request: Request,
    next: Next,
) -> Response {
    if !auth_state.config.enabled {
        return next.run(request).await;
    }

    let auth_header = match request.headers().get("authorization") {
        Some(h) => h.to_str().unwrap_or("").to_string(),
        None => return problem_401("Missing Authorization header"),
    };

    let result = match auth_state.config.method {
        AuthMethod::Oidc => {
            let token = strip_prefix(&auth_header, "Bearer ");
            match token {
                Ok(t) => match &auth_state.jwks_client {
                    Some(client) => client.validate(t).await,
                    None => Err(AuthError::Internal("OIDC client not initialised".into())),
                },
                Err(e) => Err(e),
            }
        }
        AuthMethod::Basic => {
            let creds = strip_prefix(&auth_header, "Basic ");
            match creds {
                Ok(c) => match &auth_state.pool {
                    Some(pool) => validate_basic(pool, c).await,
                    None => Err(AuthError::Internal("DB pool not available for Basic auth".into())),
                },
                Err(e) => Err(e),
            }
        }
    };

    match result {
        Ok(user) => {
            request.extensions_mut().insert(user);
            next.run(request).await
        }
        Err(e) => {
            warn!(error = %e, "Authentication failed");
            problem_401(&e.to_string())
        }
    }
}

fn strip_prefix<'a>(header: &'a str, prefix: &str) -> Result<&'a str, AuthError> {
    header.strip_prefix(prefix).ok_or(AuthError::InvalidHeader)
}

fn problem_401(detail: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "type": "about:blank",
            "title": "Unauthorized",
            "status": 401,
            "detail": detail,
        })),
    )
        .into_response()
}
