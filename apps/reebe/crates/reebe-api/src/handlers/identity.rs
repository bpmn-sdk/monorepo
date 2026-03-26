use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::identity::{
    AuthorizationRepository, Group, GroupRepository, Role, RoleRepository, TenantRepository,
    UserRepository,
};
use sqlx::Row;
use crate::app::ApiState;
use crate::dto::identity::{
    CreateTenantRequest, CreateUserRequest,
    SearchTenantsRequest, SearchUsersRequest,
    TenantDto, UserDto,
};
use crate::error::{ApiError, ApiResult};
use crate::pagination::{PageRequest, PageResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ---- User handlers ----

pub async fn create_user(
    State(state): State<ApiState>,
    Json(req): Json<CreateUserRequest>,
) -> ApiResult<impl IntoResponse> {
    // Hash password on a blocking thread before sending the engine command.
    let password_hash = match req.password {
        Some(ref pw) => {
            let pw = pw.clone();
            let hash = tokio::task::spawn_blocking(move || {
                crate::auth::basic::hash_password(&pw)
            })
            .await
            .map_err(|e| ApiError::InternalError(e.to_string()))?
            .map_err(|e| ApiError::InternalError(e.to_string()))?;
            Some(hash)
        }
        None => None,
    };

    let payload = serde_json::json!({
        "username": req.username,
        "name": req.name,
        "email": req.email,
        "passwordHash": password_hash,
    });

    let response = state
        .engine
        .send_command(
            "USER".to_string(),
            "CREATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_user(
    State(state): State<ApiState>,
    Path(username): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let repo = UserRepository::new(&state.pool);
    let user = repo.get_by_username(&username).await.map_err(|_| ApiError::NotFound {
        resource: "user".to_string(),
        key: username.clone(),
    })?;

    Ok(Json(UserDto::from(user)))
}

pub async fn delete_user(
    State(state): State<ApiState>,
    Path(username): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "username": username,
    });

    state
        .engine
        .send_command(
            "USER".to_string(),
            "DELETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_users(
    State(state): State<ApiState>,
    Json(req): Json<SearchUsersRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_username = page.search_after.as_ref()
        .and_then(|v| v.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let repo = UserRepository::new(&state.pool);
    let users = repo
        .list(page_size, after_username.as_deref())
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let dtos: Vec<UserDto> = users.into_iter().map(Into::into).collect();
    Ok(Json(PageResponse::new(dtos, None, None)))
}

// ---- Tenant handlers ----

pub async fn create_tenant(
    State(state): State<ApiState>,
    Json(req): Json<CreateTenantRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "tenantId": req.tenant_id,
        "name": req.name,
    });

    let response = state
        .engine
        .send_command(
            "TENANT".to_string(),
            "CREATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_tenant(
    State(state): State<ApiState>,
    Path(tenant_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let repo = TenantRepository::new(&state.pool);
    let tenant = repo.get_by_id(&tenant_id).await.map_err(|_| ApiError::NotFound {
        resource: "tenant".to_string(),
        key: tenant_id.clone(),
    })?;

    Ok(Json(TenantDto::from(tenant)))
}

pub async fn search_tenants(
    State(state): State<ApiState>,
    Json(req): Json<SearchTenantsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();

    let repo = TenantRepository::new(&state.pool);
    let tenants = repo
        .list(page_size, after_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = tenants.first().map(|t| t.key);
    let last_key = tenants.last().map(|t| t.key);
    let dtos: Vec<TenantDto> = tenants.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

pub async fn patch_tenant(
    State(state): State<ApiState>,
    Path(tenant_id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "tenantId": tenant_id,
        "name": req.get("name"),
    });

    let response = state
        .engine
        .send_command(
            "TENANT".to_string(),
            "UPDATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(Json(response))
}

pub async fn delete_tenant(
    State(state): State<ApiState>,
    Path(tenant_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "tenantId": tenant_id,
    });

    state
        .engine
        .send_command(
            "TENANT".to_string(),
            "DELETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

// ---- Role DTOs ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoleRequest {
    pub role_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleDto {
    pub role_id: String,
    pub name: String,
    pub description: Option<String>,
}

impl From<Role> for RoleDto {
    fn from(r: Role) -> Self {
        Self {
            role_id: r.role_id,
            name: r.name,
            description: r.description,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRolesRequest {
    pub page: Option<PageRequest>,
}

// ---- Role handlers ----

pub async fn create_role(
    State(state): State<ApiState>,
    Json(req): Json<CreateRoleRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "roleId": req.role_id,
        "name": req.name,
        "description": req.description,
    });

    let response = state
        .engine
        .send_command(
            "ROLE".to_string(),
            "CREATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_role(
    State(state): State<ApiState>,
    Path(role_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let repo = RoleRepository::new(&state.pool);
    let role = repo.get_by_id(&role_id).await.map_err(|_| ApiError::NotFound {
        resource: "role".to_string(),
        key: role_id.clone(),
    })?;

    Ok(Json(RoleDto::from(role)))
}

pub async fn delete_role(
    State(state): State<ApiState>,
    Path(role_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "roleId": role_id,
    });

    state
        .engine
        .send_command(
            "ROLE".to_string(),
            "DELETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_roles(
    State(state): State<ApiState>,
    Json(req): Json<SearchRolesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_id = page.search_after.as_ref()
        .and_then(|v| v.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let repo = RoleRepository::new(&state.pool);
    let roles = repo
        .list(page_size, after_id.as_deref())
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let dtos: Vec<RoleDto> = roles.into_iter().map(Into::into).collect();
    Ok(Json(PageResponse::new(dtos, None, None)))
}

// ---- Group DTOs ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRequest {
    pub group_id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDto {
    pub group_id: String,
    pub name: String,
}

impl From<Group> for GroupDto {
    fn from(g: Group) -> Self {
        Self {
            group_id: g.group_id,
            name: g.name,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchGroupsRequest {
    pub page: Option<PageRequest>,
}

// ---- Group handlers ----

pub async fn create_group(
    State(state): State<ApiState>,
    Json(req): Json<CreateGroupRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "groupId": req.group_id,
        "name": req.name,
    });

    let response = state
        .engine
        .send_command(
            "GROUP".to_string(),
            "CREATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_group(
    State(state): State<ApiState>,
    Path(group_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let repo = GroupRepository::new(&state.pool);
    let group = repo.get_by_id(&group_id).await.map_err(|_| ApiError::NotFound {
        resource: "group".to_string(),
        key: group_id.clone(),
    })?;

    Ok(Json(GroupDto::from(group)))
}

pub async fn delete_group(
    State(state): State<ApiState>,
    Path(group_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "groupId": group_id,
    });

    state
        .engine
        .send_command(
            "GROUP".to_string(),
            "DELETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_groups(
    State(state): State<ApiState>,
    Json(req): Json<SearchGroupsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_id = page.search_after.as_ref()
        .and_then(|v| v.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let repo = GroupRepository::new(&state.pool);
    let groups = repo
        .list(page_size, after_id.as_deref())
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let dtos: Vec<GroupDto> = groups.into_iter().map(Into::into).collect();
    Ok(Json(PageResponse::new(dtos, None, None)))
}

// ---- Authentication ----

pub async fn get_current_user(State(_state): State<ApiState>) -> impl IntoResponse {
    Json(json!({ "username": "anonymous", "authenticated": false }))
}

// ---- Tenant Member Management ----

pub async fn assign_tenant_member(
    State(state): State<ApiState>,
    Path((tenant_id, member_id)): Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> ApiResult<impl IntoResponse> {
    let member_type = params
        .get("type")
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "USER".to_string());
    sqlx::query(
        r#"INSERT INTO tenant_members (tenant_id, member_id, member_type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(&tenant_id)
    .bind(&member_id)
    .bind(&member_type)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_tenant_member(
    State(state): State<ApiState>,
    Path((tenant_id, member_id)): Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> ApiResult<impl IntoResponse> {
    let member_type = params
        .get("type")
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "USER".to_string());
    sqlx::query(
        "DELETE FROM tenant_members WHERE tenant_id = $1 AND member_id = $2 AND member_type = $3",
    )
    .bind(&tenant_id)
    .bind(&member_id)
    .bind(&member_type)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_tenant_members(
    State(state): State<ApiState>,
    Path(tenant_id): Path<String>,
    Json(_req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let rows = sqlx::query(
        "SELECT member_id, member_type FROM tenant_members WHERE tenant_id = $1 ORDER BY member_type, member_id",
    )
    .bind(&tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "memberId": row.get::<String, _>("member_id"),
                "memberType": row.get::<String, _>("member_type"),
            })
        })
        .collect();
    let total = items.len();
    Ok(Json(json!({ "items": items, "page": { "totalItems": total } })))
}

// Convenience wrappers for user/group/role-specific routes

pub async fn assign_tenant_user(
    State(state): State<ApiState>,
    Path((tenant_id, username)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        r#"INSERT INTO tenant_members (tenant_id, member_id, member_type)
           VALUES ($1, $2, 'USER')
           ON CONFLICT DO NOTHING"#,
    )
    .bind(&tenant_id)
    .bind(&username)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_tenant_user(
    State(state): State<ApiState>,
    Path((tenant_id, username)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        "DELETE FROM tenant_members WHERE tenant_id = $1 AND member_id = $2 AND member_type = 'USER'",
    )
    .bind(&tenant_id)
    .bind(&username)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_tenant_group(
    State(state): State<ApiState>,
    Path((tenant_id, group_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        r#"INSERT INTO tenant_members (tenant_id, member_id, member_type)
           VALUES ($1, $2, 'GROUP')
           ON CONFLICT DO NOTHING"#,
    )
    .bind(&tenant_id)
    .bind(&group_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_tenant_group(
    State(state): State<ApiState>,
    Path((tenant_id, group_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        "DELETE FROM tenant_members WHERE tenant_id = $1 AND member_id = $2 AND member_type = 'GROUP'",
    )
    .bind(&tenant_id)
    .bind(&group_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_tenant_role(
    State(state): State<ApiState>,
    Path((tenant_id, role_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        r#"INSERT INTO tenant_members (tenant_id, member_id, member_type)
           VALUES ($1, $2, 'ROLE')
           ON CONFLICT DO NOTHING"#,
    )
    .bind(&tenant_id)
    .bind(&role_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_tenant_role(
    State(state): State<ApiState>,
    Path((tenant_id, role_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    sqlx::query(
        "DELETE FROM tenant_members WHERE tenant_id = $1 AND member_id = $2 AND member_type = 'ROLE'",
    )
    .bind(&tenant_id)
    .bind(&role_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

// ---- Authorization handlers ----

pub async fn create_authorization(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let repo = AuthorizationRepository::new(&state.pool);
    let key = req
        .get("key")
        .and_then(|v| v.as_i64())
        .unwrap_or_else(|| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64
        });
    let owner_key = req
        .get("ownerKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let owner_type = req
        .get("ownerType")
        .and_then(|v| v.as_str())
        .unwrap_or("USER")
        .to_string();
    let resource_type = req
        .get("resourceType")
        .and_then(|v| v.as_str())
        .unwrap_or("*")
        .to_string();
    let resource_id = req
        .get("resourceId")
        .and_then(|v| v.as_str())
        .unwrap_or("*")
        .to_string();
    let permissions: Vec<String> = req
        .get("permissions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let authz = reebe_db::state::identity::Authorization {
        key,
        owner_key,
        owner_type,
        resource_type,
        resource_id,
        permissions,
        created_at: chrono::Utc::now(),
    };

    repo.insert(&authz)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(json!({ "key": authz.key }))))
}

pub async fn delete_authorization(
    State(state): State<ApiState>,
    Path(key): Path<i64>,
) -> ApiResult<impl IntoResponse> {
    let repo = AuthorizationRepository::new(&state.pool);
    repo.delete(key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_authorizations(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let repo = AuthorizationRepository::new(&state.pool);

    let owner_key = req
        .get("ownerKey")
        .and_then(|v| v.as_str());
    let owner_type = req
        .get("ownerType")
        .and_then(|v| v.as_str())
        .unwrap_or("USER");

    let authzs = if let Some(ok) = owner_key {
        repo.get_by_owner(ok, owner_type)
            .await
            .map_err(|e| ApiError::InternalError(e.to_string()))?
    } else {
        vec![]
    };

    let items: Vec<serde_json::Value> = authzs
        .iter()
        .map(|a| {
            json!({
                "key": a.key,
                "ownerKey": a.owner_key,
                "ownerType": a.owner_type,
                "resourceType": a.resource_type,
                "resourceId": a.resource_id,
                "permissions": a.permissions,
            })
        })
        .collect();

    let total = items.len();
    Ok(Json(json!({
        "items": items,
        "page": { "totalItems": total }
    })))
}

