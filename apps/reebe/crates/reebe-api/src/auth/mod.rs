//! Authentication module — optional middleware matching Zeebe's auth model.
//!
//! Disabled by default (`enabled = false`). When enabled, supports:
//! - **OIDC**: validates `Authorization: Bearer <JWT>` against a JWKS endpoint
//! - **Basic**: validates `Authorization: Basic <base64>` against the local user DB
//!
//! Authenticated user is injected into request extensions as [`AuthenticatedUser`].

mod error;
mod oidc;
pub mod basic;
mod middleware;

pub use error::AuthError;
pub use middleware::{auth_middleware, AuthState};
pub use oidc::JwksClient;

use serde::{Deserialize, Serialize};

/// Top-level auth configuration (mirrors Zeebe's `security.authentication` config).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuthConfig {
    /// Enable authentication. Defaults to `false` (same as Zeebe default).
    #[serde(default)]
    pub enabled: bool,

    /// Authentication method. Defaults to `oidc`.
    #[serde(default)]
    pub method: AuthMethod,

    /// OIDC-specific settings (only used when `method = "oidc"`).
    #[serde(default)]
    pub oidc: OidcConfig,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            method: AuthMethod::Oidc,
            oidc: OidcConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    /// Validate JWT Bearer tokens against a remote JWKS endpoint.
    #[default]
    Oidc,
    /// Validate username/password against the local user database.
    Basic,
}

/// OIDC provider configuration.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OidcConfig {
    /// OIDC issuer URL. JWKS is fetched from `{issuer_url}/.well-known/jwks.json`.
    pub issuer_url: String,

    /// Expected token audience. If `None`, audience validation is skipped.
    pub audience: Option<String>,

    /// JWT claim to use as the username. Defaults to `"sub"`.
    #[serde(default = "default_username_claim")]
    pub username_claim: String,

    /// JWT claim containing group memberships. Defaults to `"groups"`.
    #[serde(default = "default_groups_claim")]
    pub groups_claim: String,
}

fn default_username_claim() -> String {
    "sub".to_string()
}

fn default_groups_claim() -> String {
    "groups".to_string()
}

impl Default for OidcConfig {
    fn default() -> Self {
        Self {
            issuer_url: String::new(),
            audience: None,
            username_claim: default_username_claim(),
            groups_claim: default_groups_claim(),
        }
    }
}

/// Authenticated user injected into request extensions after successful auth.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub username: String,
    pub groups: Vec<String>,
}
