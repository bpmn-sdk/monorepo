#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub key: i64,
    pub partition_id: i16,
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub element_instance_key: i64,
    pub element_id: String,
    pub error_type: String,
    pub error_message: Option<String>,
    pub state: String,
    pub job_key: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct IncidentRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> IncidentRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, incident: &Incident) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO incidents
               (key, partition_id, process_instance_key, process_definition_key,
                element_instance_key, element_id, error_type, error_message, state,
                job_key, created_at, tenant_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"#,
        )
        .bind(incident.key)
        .bind(incident.partition_id)
        .bind(incident.process_instance_key)
        .bind(incident.process_definition_key)
        .bind(incident.element_instance_key)
        .bind(&incident.element_id)
        .bind(&incident.error_type)
        .bind(&incident.error_message)
        .bind(&incident.state)
        .bind(incident.job_key)
        .bind(incident.created_at)
        .bind(&incident.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn resolve(&self, key: i64) -> Result<()> {
        sqlx::query(
            "UPDATE incidents SET state = 'RESOLVED', resolved_at = NOW() WHERE key = $1",
        )
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<Incident> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, process_definition_key,
                      element_instance_key, element_id, error_type, error_message,
                      state, job_key, created_at, resolved_at, tenant_id
               FROM incidents WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_incident(r)),
            None => Err(DbError::NotFound(format!("Incident {key}"))),
        }
    }

    pub async fn get_by_process_instance(
        &self,
        process_instance_key: i64,
    ) -> Result<Vec<Incident>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, process_definition_key,
                      element_instance_key, element_id, error_type, error_message,
                      state, job_key, created_at, resolved_at, tenant_id
               FROM incidents WHERE process_instance_key = $1 ORDER BY created_at"#,
        )
        .bind(process_instance_key)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_incident(r)).collect())
    }

    pub async fn search(
        &self,
        state_filter: Option<&str>,
        error_type: Option<&str>,
        process_instance_key: Option<i64>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<Incident>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, process_definition_key,
                      element_instance_key, element_id, error_type, error_message,
                      state, job_key, created_at, resolved_at, tenant_id
               FROM incidents
               WHERE ($1::text IS NULL OR state = $1)
                 AND ($2::text IS NULL OR error_type = $2)
                 AND ($3::bigint IS NULL OR process_instance_key = $3)
                 AND ($4::text IS NULL OR tenant_id = $4)
                 AND ($5::bigint IS NULL OR key > $5)
               ORDER BY key
               LIMIT $6"#,
        )
        .bind(state_filter)
        .bind(error_type)
        .bind(process_instance_key)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_incident(r)).collect())
    }

    pub async fn count_active(&self) -> Result<i64> {
        use sqlx::Row;
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM incidents WHERE state = 'ACTIVE'"
        )
        .fetch_one(self.pool)
        .await?;
        Ok(row.get::<i64, _>("cnt"))
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_incident(r: crate::DbRow) -> Incident {
    use sqlx::Row;
    Incident {
        key: r.get("key"),
        partition_id: r.get("partition_id"),
        process_instance_key: r.get("process_instance_key"),
        process_definition_key: r.get("process_definition_key"),
        element_instance_key: r.get("element_instance_key"),
        element_id: r.get("element_id"),
        error_type: r.get("error_type"),
        error_message: r.get("error_message"),
        state: r.get("state"),
        job_key: r.get("job_key"),
        created_at: r.get("created_at"),
        resolved_at: r.get("resolved_at"),
        tenant_id: r.get("tenant_id"),
    }
}
