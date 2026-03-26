#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timer {
    pub key: i64,
    pub process_instance_key: Option<i64>,
    pub process_definition_key: Option<i64>,
    pub element_instance_key: Option<i64>,
    pub element_id: String,
    pub due_date: DateTime<Utc>,
    pub repetitions: i32,
    pub state: String,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct TimerRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> TimerRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, timer: &Timer) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO timers
               (key, process_instance_key, process_definition_key, element_instance_key,
                element_id, due_date, repetitions, state, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(timer.key)
        .bind(timer.process_instance_key)
        .bind(timer.process_definition_key)
        .bind(timer.element_instance_key)
        .bind(&timer.element_id)
        .bind(timer.due_date)
        .bind(timer.repetitions)
        .bind(&timer.state)
        .bind(&timer.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_due(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<Timer>> {
        let rows = sqlx::query(
            r#"SELECT key, process_instance_key, process_definition_key, element_instance_key,
                      element_id, due_date, repetitions, state, tenant_id
               FROM timers
               WHERE state = 'ACTIVE' AND due_date <= $1
               ORDER BY due_date
               LIMIT $2"#,
        )
        .bind(now)
        .bind(limit)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_timer(r)).collect())
    }

    pub async fn update_state(&self, key: i64, state: &str) -> Result<()> {
        sqlx::query("UPDATE timers SET state = $1 WHERE key = $2")
            .bind(state)
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete(&self, key: i64) -> Result<()> {
        sqlx::query("DELETE FROM timers WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_process_instance(
        &self,
        process_instance_key: i64,
    ) -> Result<Vec<Timer>> {
        let rows = sqlx::query(
            r#"SELECT key, process_instance_key, process_definition_key, element_instance_key,
                      element_id, due_date, repetitions, state, tenant_id
               FROM timers WHERE process_instance_key = $1 ORDER BY key"#,
        )
        .bind(process_instance_key)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_timer(r)).collect())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<Timer> {
        let row = sqlx::query(
            r#"SELECT key, process_instance_key, process_definition_key, element_instance_key,
                      element_id, due_date, repetitions, state, tenant_id
               FROM timers WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_timer(r)),
            None => Err(DbError::NotFound(format!("Timer {key}"))),
        }
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_timer(r: crate::DbRow) -> Timer {
    use sqlx::Row;
    Timer {
        key: r.get("key"),
        process_instance_key: r.get("process_instance_key"),
        process_definition_key: r.get("process_definition_key"),
        element_instance_key: r.get("element_instance_key"),
        element_id: r.get("element_id"),
        due_date: r.get("due_date"),
        repetitions: r.get("repetitions"),
        state: r.get("state"),
        tenant_id: r.get("tenant_id"),
    }
}
