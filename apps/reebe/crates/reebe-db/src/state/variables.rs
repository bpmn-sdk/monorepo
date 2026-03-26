#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub key: i64,
    pub partition_id: i16,
    pub name: String,
    pub value: Value,
    pub scope_key: i64,
    pub process_instance_key: i64,
    pub tenant_id: String,
    pub is_preview: bool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct VariableRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> VariableRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, variable: &Variable) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO variables
               (key, partition_id, name, value, scope_key, process_instance_key, tenant_id, is_preview)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (scope_key, name)
               DO UPDATE SET key = $1, value = $4, is_preview = $8"#,
        )
        .bind(variable.key)
        .bind(variable.partition_id)
        .bind(&variable.name)
        .bind(&variable.value)
        .bind(variable.scope_key)
        .bind(variable.process_instance_key)
        .bind(&variable.tenant_id)
        .bind(variable.is_preview)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_scope(&self, scope_key: i64) -> Result<Vec<Variable>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, name, value, scope_key, process_instance_key,
                      tenant_id, is_preview
               FROM variables WHERE scope_key = $1 ORDER BY name"#,
        )
        .bind(scope_key)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| Variable {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                name: r.get("name"),
                value: r.get("value"),
                scope_key: r.get("scope_key"),
                process_instance_key: r.get("process_instance_key"),
                tenant_id: r.get("tenant_id"),
                is_preview: r.get("is_preview"),
            })
            .collect())
    }

    pub async fn get_by_name_in_scope(
        &self,
        scope_key: i64,
        name: &str,
    ) -> Result<Option<Variable>> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, name, value, scope_key, process_instance_key,
                      tenant_id, is_preview
               FROM variables WHERE scope_key = $1 AND name = $2"#,
        )
        .bind(scope_key)
        .bind(name)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.map(|r| Variable {
            key: r.get("key"),
            partition_id: r.get("partition_id"),
            name: r.get("name"),
            value: r.get("value"),
            scope_key: r.get("scope_key"),
            process_instance_key: r.get("process_instance_key"),
            tenant_id: r.get("tenant_id"),
            is_preview: r.get("is_preview"),
        }))
    }

    pub async fn search(
        &self,
        process_instance_key: Option<i64>,
        scope_key: Option<i64>,
        name: Option<&str>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<Variable>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, name, value, scope_key, process_instance_key,
                      tenant_id, is_preview
               FROM variables
               WHERE ($1::bigint IS NULL OR process_instance_key = $1)
                 AND ($2::bigint IS NULL OR scope_key = $2)
                 AND ($3::text IS NULL OR name = $3)
                 AND ($4::text IS NULL OR tenant_id = $4)
                 AND ($5::bigint IS NULL OR key > $5)
               ORDER BY key
               LIMIT $6"#,
        )
        .bind(process_instance_key)
        .bind(scope_key)
        .bind(name)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| Variable {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                name: r.get("name"),
                value: r.get("value"),
                scope_key: r.get("scope_key"),
                process_instance_key: r.get("process_instance_key"),
                tenant_id: r.get("tenant_id"),
                is_preview: r.get("is_preview"),
            })
            .collect())
    }
}
