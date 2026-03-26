#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementInstance {
    pub key: i64,
    pub partition_id: i16,
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub element_id: String,
    pub element_type: String,
    pub state: String,
    pub flow_scope_key: Option<i64>,
    pub scope_key: Option<i64>,
    pub incident_key: Option<i64>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct ElementInstanceRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> ElementInstanceRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, ei: &ElementInstance) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO element_instances
               (key, partition_id, process_instance_key, process_definition_key, bpmn_process_id,
                element_id, element_type, state, flow_scope_key, scope_key, incident_key, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"#,
        )
        .bind(ei.key)
        .bind(ei.partition_id)
        .bind(ei.process_instance_key)
        .bind(ei.process_definition_key)
        .bind(&ei.bpmn_process_id)
        .bind(&ei.element_id)
        .bind(&ei.element_type)
        .bind(&ei.state)
        .bind(ei.flow_scope_key)
        .bind(ei.scope_key)
        .bind(ei.incident_key)
        .bind(&ei.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_state(&self, key: i64, state: &str) -> Result<()> {
        sqlx::query("UPDATE element_instances SET state = $1 WHERE key = $2")
            .bind(state)
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<ElementInstance> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, process_definition_key,
                      bpmn_process_id, element_id, element_type, state,
                      flow_scope_key, scope_key, incident_key, tenant_id
               FROM element_instances WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(ElementInstance {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                process_instance_key: r.get("process_instance_key"),
                process_definition_key: r.get("process_definition_key"),
                bpmn_process_id: r.get("bpmn_process_id"),
                element_id: r.get("element_id"),
                element_type: r.get("element_type"),
                state: r.get("state"),
                flow_scope_key: r.get("flow_scope_key"),
                scope_key: r.get("scope_key"),
                incident_key: r.get("incident_key"),
                tenant_id: r.get("tenant_id"),
            }),
            None => Err(DbError::NotFound(format!("Element instance {key}"))),
        }
    }

    pub async fn get_by_process_instance(
        &self,
        process_instance_key: i64,
    ) -> Result<Vec<ElementInstance>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, process_definition_key,
                      bpmn_process_id, element_id, element_type, state,
                      flow_scope_key, scope_key, incident_key, tenant_id
               FROM element_instances WHERE process_instance_key = $1 ORDER BY key"#,
        )
        .bind(process_instance_key)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| ElementInstance {
                key: r.get("key"),
                partition_id: r.get("partition_id"),
                process_instance_key: r.get("process_instance_key"),
                process_definition_key: r.get("process_definition_key"),
                bpmn_process_id: r.get("bpmn_process_id"),
                element_id: r.get("element_id"),
                element_type: r.get("element_type"),
                state: r.get("state"),
                flow_scope_key: r.get("flow_scope_key"),
                scope_key: r.get("scope_key"),
                incident_key: r.get("incident_key"),
                tenant_id: r.get("tenant_id"),
            })
            .collect())
    }

    pub async fn delete_by_process_instance(&self, process_instance_key: i64) -> Result<()> {
        sqlx::query(
            "DELETE FROM element_instances WHERE process_instance_key = $1",
        )
        .bind(process_instance_key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_active_count(&self, process_instance_key: i64) -> Result<i64> {
        let row = sqlx::query(
            r#"SELECT COUNT(*) as cnt FROM element_instances
               WHERE process_instance_key = $1
                 AND state NOT IN ('COMPLETED', 'TERMINATED')
                 AND element_type != 'PROCESS'"#,
        )
        .bind(process_instance_key)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.get::<i64, _>("cnt"))
    }

    pub async fn complete_process_element(&self, process_instance_key: i64) -> Result<()> {
        sqlx::query(
            "UPDATE element_instances SET state = 'COMPLETED' WHERE process_instance_key = $1 AND element_type = 'PROCESS'",
        )
        .bind(process_instance_key)
        .execute(self.pool)
        .await?;
        Ok(())
    }
}
