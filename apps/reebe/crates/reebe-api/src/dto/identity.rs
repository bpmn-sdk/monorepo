use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRequest {
    pub username: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub username: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub enabled: bool,
}

impl From<reebe_db::state::identity::User> for UserDto {
    fn from(u: reebe_db::state::identity::User) -> Self {
        Self {
            username: u.username,
            name: u.name,
            email: u.email,
            enabled: u.enabled,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchUsersRequest {
    pub filter: Option<UserFilter>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserFilter {
    pub username: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTenantRequest {
    pub tenant_id: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantDto {
    pub tenant_key: String,
    pub tenant_id: String,
    pub name: Option<String>,
}

impl From<reebe_db::state::identity::Tenant> for TenantDto {
    fn from(t: reebe_db::state::identity::Tenant) -> Self {
        Self {
            tenant_key: t.key.to_string(),
            tenant_id: t.tenant_id,
            name: t.name,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchTenantsRequest {
    pub filter: Option<TenantFilter>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantFilter {
    pub tenant_id: Option<String>,
    pub name: Option<String>,
}
