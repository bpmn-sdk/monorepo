#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInstance {
    pub key: i64,
    pub partition_id: i16,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub version: i32,
    pub state: String,
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub parent_process_instance_key: Option<i64>,
    pub parent_element_instance_key: Option<i64>,
    pub root_process_instance_key: i64,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct ProcessInstanceRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> ProcessInstanceRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, instance: &ProcessInstance) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO process_instances
               (key, partition_id, process_definition_key, bpmn_process_id, version, state,
                start_date, parent_process_instance_key, parent_element_instance_key,
                root_process_instance_key, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"#,
        )
        .bind(instance.key)
        .bind(instance.partition_id)
        .bind(instance.process_definition_key)
        .bind(&instance.bpmn_process_id)
        .bind(instance.version)
        .bind(&instance.state)
        .bind(instance.start_date)
        .bind(instance.parent_process_instance_key)
        .bind(instance.parent_element_instance_key)
        .bind(instance.root_process_instance_key)
        .bind(&instance.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_state(
        &self,
        key: i64,
        state: &str,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE process_instances SET state = $1, end_date = $2 WHERE key = $3",
        )
        .bind(state)
        .bind(end_date)
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<ProcessInstance> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, process_definition_key, bpmn_process_id, version,
                      state, start_date, end_date, parent_process_instance_key,
                      parent_element_instance_key, root_process_instance_key, tenant_id
               FROM process_instances WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(ProcessInstance {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                process_definition_key: r.get("process_definition_key"),
                bpmn_process_id: r.get("bpmn_process_id"),
                version: r.get("version"),
                state: r.get("state"),
                start_date: r.get("start_date"),
                end_date: r.get("end_date"),
                parent_process_instance_key: r.get("parent_process_instance_key"),
                parent_element_instance_key: r.get("parent_element_instance_key"),
                root_process_instance_key: r.get("root_process_instance_key"),
                tenant_id: r.get("tenant_id"),
            }),
            None => Err(DbError::NotFound(format!("Process instance {key}"))),
        }
    }

    pub async fn search(
        &self,
        state_filter: Option<&str>,
        bpmn_process_id: Option<&str>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<ProcessInstance>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_definition_key, bpmn_process_id, version,
                      state, start_date, end_date, parent_process_instance_key,
                      parent_element_instance_key, root_process_instance_key, tenant_id
               FROM process_instances
               WHERE ($1::text IS NULL OR state = $1)
                 AND ($2::text IS NULL OR bpmn_process_id = $2)
                 AND ($3::text IS NULL OR tenant_id = $3)
                 AND ($4::bigint IS NULL OR key > $4)
               ORDER BY key
               LIMIT $5"#,
        )
        .bind(state_filter)
        .bind(bpmn_process_id)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| ProcessInstance {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                process_definition_key: r.get("process_definition_key"),
                bpmn_process_id: r.get("bpmn_process_id"),
                version: r.get("version"),
                state: r.get("state"),
                start_date: r.get("start_date"),
                end_date: r.get("end_date"),
                parent_process_instance_key: r.get("parent_process_instance_key"),
                parent_element_instance_key: r.get("parent_element_instance_key"),
                root_process_instance_key: r.get("root_process_instance_key"),
                tenant_id: r.get("tenant_id"),
            })
            .collect())
    }

    pub async fn count_active(&self) -> Result<i64> {
        use sqlx::Row;
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM process_instances WHERE state NOT IN ('COMPLETED', 'CANCELED', 'TERMINATED')"
        )
        .fetch_one(self.pool)
        .await?;
        Ok(row.get::<i64, _>("cnt"))
    }
}
