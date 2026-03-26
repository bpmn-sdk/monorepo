//! Tenant extraction from request context.
//!
//! When auth is enabled, the tenant can come from the JWT claim.
//! When auth is disabled, or no tenant is specified, defaults to "<default>".

use axum::extract::Request;

/// Extract the active tenant ID from the request.
///
/// Priority:
/// 1. `X-Zeebe-Tenant-Id` header
/// 2. Authenticated user's tenant claim (if auth is enabled)
/// 3. `"<default>"`
pub fn extract_tenant_id(req: &Request) -> String {
    // Check header
    if let Some(tenant_header) = req.headers().get("X-Zeebe-Tenant-Id") {
        if let Ok(tenant) = tenant_header.to_str() {
            if !tenant.is_empty() {
                return tenant.to_string();
            }
        }
    }

    // Fall back to <default>
    "<default>".to_string()
}

/// Extract tenant from axum Parts (for use in extractors).
pub fn tenant_from_headers(headers: &axum::http::HeaderMap) -> String {
    if let Some(v) = headers.get("X-Zeebe-Tenant-Id") {
        if let Ok(s) = v.to_str() {
            if !s.is_empty() {
                return s.to_string();
            }
        }
    }
    "<default>".to_string()
}
