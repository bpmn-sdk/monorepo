//! Authorization framework for resource-level access control.
//!
//! When auth is disabled, all operations are permitted.
//! When auth is enabled, checks authorizations table in DB.
//!
//! Mirrors Zeebe's authorization model:
//! - Owner: user or group
//! - Resource type: PROCESS_DEFINITION, PROCESS_INSTANCE, DECISION_DEFINITION, etc.
//! - Permission: CREATE, READ, UPDATE, DELETE, CREATE_PROCESS_INSTANCE, etc.

use sqlx::Row;
use crate::auth::AuthenticatedUser;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResourceType {
    ProcessDefinition,
    ProcessInstance,
    DecisionDefinition,
    DecisionInstance,
    Job,
    Message,
    Signal,
    UserTask,
    Deployment,
    Variable,
    Incident,
    Tenant,
    User,
    Role,
    Group,
    Authorization,
}

impl ResourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ProcessDefinition => "PROCESS_DEFINITION",
            Self::ProcessInstance => "PROCESS_INSTANCE",
            Self::DecisionDefinition => "DECISION_DEFINITION",
            Self::DecisionInstance => "DECISION_INSTANCE",
            Self::Job => "JOB",
            Self::Message => "MESSAGE",
            Self::Signal => "SIGNAL",
            Self::UserTask => "USER_TASK",
            Self::Deployment => "DEPLOYMENT",
            Self::Variable => "VARIABLE",
            Self::Incident => "INCIDENT",
            Self::Tenant => "TENANT",
            Self::User => "USER",
            Self::Role => "ROLE",
            Self::Group => "GROUP",
            Self::Authorization => "AUTHORIZATION",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Permission {
    Create,
    Read,
    Update,
    Delete,
    CreateProcessInstance,
    CancelProcessInstance,
    UpdateProcessInstance,
    ReadUserTask,
    AssignUserTask,
    CompleteUserTask,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Create => "CREATE",
            Self::Read => "READ",
            Self::Update => "UPDATE",
            Self::Delete => "DELETE",
            Self::CreateProcessInstance => "CREATE_PROCESS_INSTANCE",
            Self::CancelProcessInstance => "CANCEL_PROCESS_INSTANCE",
            Self::UpdateProcessInstance => "UPDATE_PROCESS_INSTANCE",
            Self::ReadUserTask => "READ_USER_TASK",
            Self::AssignUserTask => "ASSIGN_USER_TASK",
            Self::CompleteUserTask => "COMPLETE_USER_TASK",
        }
    }
}

/// Check if the given user has permission for the resource.
///
/// Returns `Ok(())` if authorized, `Err(AuthorizationError)` if not.
///
/// When user is None (unauthenticated / auth disabled), always permits.
/// When auth is active, checks the authorizations table.
pub async fn check_authorization(
    pool: &reebe_db::DbPool,
    user: Option<&AuthenticatedUser>,
    resource_type: ResourceType,
    permission: Permission,
    resource_id: Option<&str>,
) -> Result<(), AuthorizationError> {
    // When auth is disabled (no user in context), permit everything
    let Some(user) = user else {
        return Ok(());
    };

    // Check authorizations table: does this user or any of their groups have the permission?
    let resource_type_str = resource_type.as_str();
    let permission_str = permission.as_str();
    let resource_id_filter = resource_id.unwrap_or("*");

    #[cfg(feature = "postgres")]
    let rows = sqlx::query(
        r#"
        SELECT COUNT(*)
        FROM authorizations
        WHERE resource_type = $1
          AND (resource_id = $3 OR resource_id = '*')
          AND permissions @> $2::jsonb
          AND (
            (owner_type = 'USER' AND owner_key = $4)
            OR (owner_type = 'GROUP' AND owner_key = ANY($5))
          )
        "#,
    )
    .bind(resource_type_str)
    .bind(serde_json::json!([permission_str]))
    .bind(resource_id_filter)
    .bind(&user.username)
    .bind(&user.groups)
    .fetch_one(pool)
    .await;

    #[cfg(feature = "sqlite")]
    let groups_json = serde_json::to_string(&user.groups).unwrap_or_else(|_| "[]".to_string());
    #[cfg(feature = "sqlite")]
    let rows = sqlx::query(
        r#"
        SELECT COUNT(*)
        FROM authorizations
        WHERE resource_type = $1
          AND (resource_id = $3 OR resource_id = '*')
          AND EXISTS (SELECT 1 FROM json_each(permissions) WHERE value = $2)
          AND (
            (owner_type = 'USER' AND owner_key = $4)
            OR (owner_type = 'GROUP' AND owner_key IN (SELECT value FROM json_each($5)))
          )
        "#,
    )
    .bind(resource_type_str)
    .bind(permission_str)
    .bind(resource_id_filter)
    .bind(&user.username)
    .bind(&groups_json)
    .fetch_one(pool)
    .await;

    match rows {
        Ok(row) => {
            let count: i64 = row.get(0);
            if count > 0 {
                Ok(())
            } else {
                Err(AuthorizationError::Forbidden {
                    user: user.username.clone(),
                    resource_type: resource_type_str.to_string(),
                    permission: permission_str.to_string(),
                })
            }
        }
        Err(_) => {
            // On DB error, deny to fail safe
            Err(AuthorizationError::Forbidden {
                user: user.username.clone(),
                resource_type: resource_type_str.to_string(),
                permission: permission_str.to_string(),
            })
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthorizationError {
    #[error("User '{user}' does not have permission '{permission}' on resource type '{resource_type}'")]
    Forbidden {
        user: String,
        resource_type: String,
        permission: String,
    },
}
