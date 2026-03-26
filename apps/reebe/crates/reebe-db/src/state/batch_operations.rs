#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use sqlx::Row;
use crate::{Result, DbError};

#[derive(Debug, Clone)]
pub struct BatchOperation {
    pub key: i64,
    pub operation_type: String,
    pub state: String,
    pub items_count: i64,
    pub completed_items: i64,
    pub failed_items: i64,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct BatchOperationRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> BatchOperationRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, op: &BatchOperation) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO batch_operations
               (key, operation_type, state, items_count, completed_items, failed_items,
                error_message, created_at, completed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(op.key)
        .bind(&op.operation_type)
        .bind(&op.state)
        .bind(op.items_count)
        .bind(op.completed_items)
        .bind(op.failed_items)
        .bind(&op.error_message)
        .bind(op.created_at)
        .bind(op.completed_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<BatchOperation> {
        let row = sqlx::query(
            r#"SELECT key, operation_type, state, items_count, completed_items, failed_items,
                      error_message, created_at, completed_at
               FROM batch_operations WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_batch_op(r)),
            None => Err(DbError::NotFound(format!("BatchOperation {key}"))),
        }
    }

    pub async fn update_progress(
        &self,
        key: i64,
        completed: i64,
        failed: i64,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE batch_operations SET completed_items = $1, failed_items = $2 WHERE key = $3",
        )
        .bind(completed)
        .bind(failed)
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn mark_completed(&self, key: i64) -> Result<()> {
        sqlx::query(
            "UPDATE batch_operations SET state = 'COMPLETED', completed_at = NOW() WHERE key = $1",
        )
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn search(
        &self,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<BatchOperation>> {
        let rows = sqlx::query(
            r#"SELECT key, operation_type, state, items_count, completed_items, failed_items,
                      error_message, created_at, completed_at
               FROM batch_operations
               WHERE ($1::bigint IS NULL OR key > $1)
               ORDER BY key
               LIMIT $2"#,
        )
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(row_to_batch_op).collect())
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_batch_op(r: crate::DbRow) -> BatchOperation {
    BatchOperation {
        key: r.get("key"),
        operation_type: r.get("operation_type"),
        state: r.get("state"),
        items_count: r.get("items_count"),
        completed_items: r.get("completed_items"),
        failed_items: r.get("failed_items"),
        error_message: r.get("error_message"),
        created_at: r.get("created_at"),
        completed_at: r.get("completed_at"),
    }
}
