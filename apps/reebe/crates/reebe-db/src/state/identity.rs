#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

// ---- Tenant ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tenant {
    pub key: i64,
    pub tenant_id: String,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct TenantRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> TenantRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, tenant: &Tenant) -> Result<()> {
        sqlx::query(
            "INSERT INTO tenants (key, tenant_id, name, created_at) VALUES ($1, $2, $3, $4)",
        )
        .bind(tenant.key)
        .bind(&tenant.tenant_id)
        .bind(&tenant.name)
        .bind(tenant.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_id(&self, tenant_id: &str) -> Result<Tenant> {
        let row = sqlx::query(
            "SELECT key, tenant_id, name, created_at FROM tenants WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(Tenant {
                key: r.get("key"),
                tenant_id: r.get("tenant_id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
            }),
            None => Err(DbError::NotFound(format!("Tenant {tenant_id}"))),
        }
    }

    pub async fn list(&self, page_size: i64, after_key: Option<i64>) -> Result<Vec<Tenant>> {
        let rows = sqlx::query(
            r#"SELECT key, tenant_id, name, created_at FROM tenants
               WHERE ($1::bigint IS NULL OR key > $1)
               ORDER BY key LIMIT $2"#,
        )
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| Tenant {
                key: r.get("key"),
                tenant_id: r.get("tenant_id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    pub async fn delete(&self, tenant_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM tenants WHERE tenant_id = $1")
            .bind(tenant_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

// ---- User ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct UserRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> UserRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, user: &User) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO users (username, name, email, password_hash, enabled, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(&user.username)
        .bind(&user.name)
        .bind(&user.email)
        .bind(&user.password_hash)
        .bind(user.enabled)
        .bind(user.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_username(&self, username: &str) -> Result<User> {
        let row = sqlx::query(
            "SELECT username, name, email, password_hash, enabled, created_at FROM users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(User {
                username: r.get("username"),
                name: r.get("name"),
                email: r.get("email"),
                password_hash: r.get("password_hash"),
                enabled: r.get("enabled"),
                created_at: r.get("created_at"),
            }),
            None => Err(DbError::NotFound(format!("User {username}"))),
        }
    }

    pub async fn update_enabled(&self, username: &str, enabled: bool) -> Result<()> {
        sqlx::query("UPDATE users SET enabled = $1 WHERE username = $2")
            .bind(enabled)
            .bind(username)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete(&self, username: &str) -> Result<()> {
        sqlx::query("DELETE FROM users WHERE username = $1")
            .bind(username)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn list(&self, page_size: i64, after_username: Option<&str>) -> Result<Vec<User>> {
        let rows = sqlx::query(
            r#"SELECT username, name, email, password_hash, enabled, created_at FROM users
               WHERE ($1::text IS NULL OR username > $1)
               ORDER BY username LIMIT $2"#,
        )
        .bind(after_username)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| User {
                username: r.get("username"),
                name: r.get("name"),
                email: r.get("email"),
                password_hash: r.get("password_hash"),
                enabled: r.get("enabled"),
                created_at: r.get("created_at"),
            })
            .collect())
    }
}

// ---- Role ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub role_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct RoleRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> RoleRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, role: &Role) -> Result<()> {
        sqlx::query(
            "INSERT INTO roles (role_id, name, description, created_at) VALUES ($1, $2, $3, $4)",
        )
        .bind(&role.role_id)
        .bind(&role.name)
        .bind(&role.description)
        .bind(role.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_id(&self, role_id: &str) -> Result<Role> {
        let row = sqlx::query(
            "SELECT role_id, name, description, created_at FROM roles WHERE role_id = $1",
        )
        .bind(role_id)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(Role {
                role_id: r.get("role_id"),
                name: r.get("name"),
                description: r.get("description"),
                created_at: r.get("created_at"),
            }),
            None => Err(DbError::NotFound(format!("Role {role_id}"))),
        }
    }

    pub async fn list(&self, page_size: i64, after_id: Option<&str>) -> Result<Vec<Role>> {
        let rows = sqlx::query(
            r#"SELECT role_id, name, description, created_at FROM roles
               WHERE ($1::text IS NULL OR role_id > $1)
               ORDER BY role_id LIMIT $2"#,
        )
        .bind(after_id)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| Role {
                role_id: r.get("role_id"),
                name: r.get("name"),
                description: r.get("description"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    pub async fn delete(&self, role_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE role_id = $1")
            .bind(role_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

// ---- Group ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub group_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct GroupRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> GroupRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, group: &Group) -> Result<()> {
        sqlx::query(
            "INSERT INTO groups (group_id, name, created_at) VALUES ($1, $2, $3)",
        )
        .bind(&group.group_id)
        .bind(&group.name)
        .bind(group.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_id(&self, group_id: &str) -> Result<Group> {
        let row = sqlx::query(
            "SELECT group_id, name, created_at FROM groups WHERE group_id = $1",
        )
        .bind(group_id)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(Group {
                group_id: r.get("group_id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
            }),
            None => Err(DbError::NotFound(format!("Group {group_id}"))),
        }
    }

    pub async fn list(&self, page_size: i64, after_id: Option<&str>) -> Result<Vec<Group>> {
        let rows = sqlx::query(
            r#"SELECT group_id, name, created_at FROM groups
               WHERE ($1::text IS NULL OR group_id > $1)
               ORDER BY group_id LIMIT $2"#,
        )
        .bind(after_id)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| Group {
                group_id: r.get("group_id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    pub async fn delete(&self, group_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM groups WHERE group_id = $1")
            .bind(group_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

// ---- Authorization ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authorization {
    pub key: i64,
    pub owner_key: String,
    pub owner_type: String,
    pub resource_type: String,
    pub resource_id: String,
    pub permissions: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct AuthorizationRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> AuthorizationRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, authz: &Authorization) -> Result<()> {
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"INSERT INTO authorizations
               (key, owner_key, owner_type, resource_type, resource_id, permissions, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (owner_key, owner_type, resource_type, resource_id)
               DO UPDATE SET permissions = $6"#,
        )
        .bind(authz.key)
        .bind(&authz.owner_key)
        .bind(&authz.owner_type)
        .bind(&authz.resource_type)
        .bind(&authz.resource_id)
        .bind(&authz.permissions)
        .bind(authz.created_at)
        .execute(self.pool)
        .await?;

        #[cfg(feature = "sqlite")]
        {
            let perms_json = serde_json::to_string(&authz.permissions).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                r#"INSERT INTO authorizations
                   (key, owner_key, owner_type, resource_type, resource_id, permissions, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (owner_key, owner_type, resource_type, resource_id)
                   DO UPDATE SET permissions = $6"#,
            )
            .bind(authz.key)
            .bind(&authz.owner_key)
            .bind(&authz.owner_type)
            .bind(&authz.resource_type)
            .bind(&authz.resource_id)
            .bind(&perms_json)
            .bind(authz.created_at.to_rfc3339())
            .execute(self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<Authorization> {
        let row = sqlx::query(
            r#"SELECT key, owner_key, owner_type, resource_type, resource_id, permissions, created_at
               FROM authorizations WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_authz(r)),
            None => Err(DbError::NotFound(format!("Authorization {key}"))),
        }
    }

    pub async fn get_by_owner(
        &self,
        owner_key: &str,
        owner_type: &str,
    ) -> Result<Vec<Authorization>> {
        let rows = sqlx::query(
            r#"SELECT key, owner_key, owner_type, resource_type, resource_id, permissions, created_at
               FROM authorizations WHERE owner_key = $1 AND owner_type = $2 ORDER BY key"#,
        )
        .bind(owner_key)
        .bind(owner_type)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_authz(r)).collect())
    }

    pub async fn delete(&self, key: i64) -> Result<()> {
        sqlx::query("DELETE FROM authorizations WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_authz(r: crate::DbRow) -> Authorization {
    use sqlx::Row;

    #[cfg(feature = "postgres")]
    return Authorization {
        key: r.get("key"),
        owner_key: r.get("owner_key"),
        owner_type: r.get("owner_type"),
        resource_type: r.get("resource_type"),
        resource_id: r.get("resource_id"),
        permissions: r.get("permissions"),
        created_at: r.get("created_at"),
    };

    #[cfg(feature = "sqlite")]
    {
        let permissions: Vec<String> = serde_json::from_str(
            &r.get::<String, _>("permissions")
        ).unwrap_or_default();
        let created_at: chrono::DateTime<chrono::Utc> = r
            .get::<String, _>("created_at")
            .parse()
            .unwrap_or_else(|_| chrono::Utc::now());
        Authorization {
            key: r.get("key"),
            owner_key: r.get("owner_key"),
            owner_type: r.get("owner_type"),
            resource_type: r.get("resource_type"),
            resource_id: r.get("resource_id"),
            permissions,
            created_at,
        }
    }
}
