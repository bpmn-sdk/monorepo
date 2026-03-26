use jsonwebtoken::{decode, decode_header, DecodingKey, Validation};
use jsonwebtoken::jwk::JwkSet;
use tokio::sync::RwLock;
use tracing::{info, warn};

use super::{AuthError, AuthenticatedUser, OidcConfig};

/// Fetches and caches a JWKS from the OIDC issuer, validates JWT Bearer tokens.
pub struct JwksClient {
    config: OidcConfig,
    http: reqwest::Client,
    /// Cached JWK set; refreshed on key-not-found or explicit refresh.
    cache: RwLock<JwkSet>,
}

impl JwksClient {
    /// Build a new client. Pre-fetches JWKS on construction; logs a warning (not a panic)
    /// if the issuer is unreachable so the server can still start.
    pub async fn new(config: OidcConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client");

        let client = Self {
            config,
            http,
            cache: RwLock::new(JwkSet { keys: vec![] }),
        };

        if let Err(e) = client.refresh_jwks().await {
            warn!(error = %e, "Could not pre-fetch JWKS; will retry on first request");
        }

        client
    }

    async fn refresh_jwks(&self) -> Result<(), AuthError> {
        let url = format!(
            "{}/.well-known/jwks.json",
            self.config.issuer_url.trim_end_matches('/')
        );
        info!(url = %url, "Fetching JWKS");

        let jwks: JwkSet = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?
            .error_for_status()
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?
            .json()
            .await
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?;

        *self.cache.write().await = jwks;
        Ok(())
    }

    /// Validate a raw JWT string and return the authenticated user.
    /// On `KeyNotFound`, refreshes the JWKS once and retries (handles key rotation).
    pub async fn validate(&self, token: &str) -> Result<AuthenticatedUser, AuthError> {
        let header =
            decode_header(token).map_err(|e| AuthError::InvalidToken(e.to_string()))?;

        let result = self.validate_with_cache(token, &header).await;

        if matches!(result, Err(AuthError::KeyNotFound)) {
            // Key may have rotated; refresh and retry once.
            if let Err(e) = self.refresh_jwks().await {
                warn!(error = %e, "JWKS refresh failed during key rotation retry");
            }
            return self.validate_with_cache(token, &header).await;
        }

        result
    }

    async fn validate_with_cache(
        &self,
        token: &str,
        header: &jsonwebtoken::Header,
    ) -> Result<AuthenticatedUser, AuthError> {
        let jwks = self.cache.read().await;

        let jwk = match &header.kid {
            Some(kid) => jwks.find(kid).ok_or(AuthError::KeyNotFound)?,
            // No kid: try the first key in the set.
            None => jwks.keys.first().ok_or(AuthError::KeyNotFound)?,
        };

        let decoding_key =
            DecodingKey::from_jwk(jwk).map_err(|e| AuthError::InvalidToken(e.to_string()))?;

        let mut validation = Validation::new(header.alg);
        match &self.config.audience {
            Some(aud) => validation.set_audience(&[aud]),
            None => validation.validate_aud = false,
        }

        let token_data = decode::<serde_json::Value>(token, &decoding_key, &validation)
            .map_err(|e| AuthError::InvalidToken(e.to_string()))?;

        let username = token_data
            .claims
            .get(&self.config.username_claim)
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let groups = token_data
            .claims
            .get(&self.config.groups_claim)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();

        Ok(AuthenticatedUser { username, groups })
    }
}
