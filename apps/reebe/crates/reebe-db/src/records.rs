#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbRecord {
    pub partition_id: i16,
    pub position: i64,
    pub record_type: String,
    pub value_type: String,
    pub intent: String,
    pub record_key: i64,
    pub timestamp_ms: i64,
    pub payload: Value,
    pub source_position: Option<i64>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct RecordRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> RecordRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, record: &DbRecord) -> Result<i64> {
        let row = sqlx::query(
            r#"
            INSERT INTO partition_records
                (partition_id, position, record_type, value_type, intent, record_key, timestamp_ms, payload, source_position, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING position
            "#,
        )
        .bind(record.partition_id)
        .bind(record.position)
        .bind(&record.record_type)
        .bind(&record.value_type)
        .bind(&record.intent)
        .bind(record.record_key)
        .bind(record.timestamp_ms)
        .bind(&record.payload)
        .bind(record.source_position)
        .bind(&record.tenant_id)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.get("position"))
    }

    /// Insert multiple records in a single multi-row INSERT statement.
    /// All records must already have positions assigned.
    pub async fn insert_batch(&self, records: &[DbRecord]) -> Result<()> {
        if records.is_empty() {
            return Ok(());
        }
        let mut qb = sqlx::QueryBuilder::new(
            "INSERT INTO partition_records \
             (partition_id, position, record_type, value_type, intent, record_key, \
              timestamp_ms, payload, source_position, tenant_id) ",
        );
        qb.push_values(records, |mut b, r| {
            b.push_bind(r.partition_id)
             .push_bind(r.position)
             .push_bind(&r.record_type)
             .push_bind(&r.value_type)
             .push_bind(&r.intent)
             .push_bind(r.record_key)
             .push_bind(r.timestamp_ms)
             .push_bind(&r.payload)
             .push_bind(r.source_position)
             .push_bind(&r.tenant_id);
        });
        qb.build().execute(self.pool).await?;
        Ok(())
    }

    pub async fn next_position(&self, partition_id: i16) -> Result<i64> {
        // Atomic increment: initialise if not present, then bump and return the old value.
        let row = sqlx::query(
            r#"INSERT INTO partition_key_state (partition_id, next_key, next_position)
               VALUES ($1, 1, 2)
               ON CONFLICT (partition_id) DO UPDATE
                   SET next_position = partition_key_state.next_position + 1
               RETURNING next_position - 1 AS pos"#,
        )
        .bind(partition_id)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.get::<i64, _>("pos"))
    }

    /// Reserve `count` consecutive positions in one atomic round-trip.
    /// Returns the first position; subsequent positions are first+1, first+2, …
    pub async fn next_position_batch(&self, partition_id: i16, count: usize) -> Result<i64> {
        let n = count as i64;
        let row = sqlx::query(
            r#"INSERT INTO partition_key_state (partition_id, next_key, next_position)
               VALUES ($1, 1, $2 + 1)
               ON CONFLICT (partition_id) DO UPDATE
                   SET next_position = partition_key_state.next_position + $2
               RETURNING next_position - $2 AS first_pos"#,
        )
        .bind(partition_id)
        .bind(n)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.get::<i64, _>("first_pos"))
    }

    /// Atomically acquire a position and a key in a single round-trip.
    /// Returns (position, key).
    pub async fn next_position_and_key(&self, partition_id: i16) -> Result<(i64, i64)> {
        let row = sqlx::query(
            r#"INSERT INTO partition_key_state (partition_id, next_key, next_position)
               VALUES ($1, 2, 2)
               ON CONFLICT (partition_id) DO UPDATE
                   SET next_key      = partition_key_state.next_key + 1,
                       next_position = partition_key_state.next_position + 1
               RETURNING next_position - 1 AS pos, next_key - 1 AS key"#,
        )
        .bind(partition_id)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok((row.get::<i64, _>("pos"), row.get::<i64, _>("key")))
    }

    pub async fn fetch_commands_from(
        &self,
        partition_id: i16,
        from_position: i64,
        limit: i32,
    ) -> Result<Vec<DbRecord>> {
        let rows = sqlx::query(
            r#"
            SELECT partition_id, position, record_type, value_type, intent, record_key,
                   timestamp_ms, payload, source_position, tenant_id
            FROM partition_records
            WHERE partition_id = $1 AND position >= $2 AND record_type = 'COMMAND'
            ORDER BY position
            LIMIT $3
            "#,
        )
        .bind(partition_id)
        .bind(from_position)
        .bind(limit as i64)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        let records = rows
            .into_iter()
            .map(|row| DbRecord {
                partition_id: row.get("partition_id"),
                position: row.get("position"),
                record_type: row.get("record_type"),
                value_type: row.get("value_type"),
                intent: row.get("intent"),
                record_key: row.get("record_key"),
                timestamp_ms: row.get("timestamp_ms"),
                payload: row.get("payload"),
                source_position: row.get("source_position"),
                tenant_id: row.get("tenant_id"),
            })
            .collect();

        Ok(records)
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn next_key(pool: &DbPool, partition_id: i16) -> Result<i64> {
    // Upsert: auto-initialise the row if it doesn't exist yet (e.g. new partition).
    let row = sqlx::query(
        r#"
        INSERT INTO partition_key_state (partition_id, next_key) VALUES ($1, 2)
        ON CONFLICT (partition_id) DO UPDATE
            SET next_key = partition_key_state.next_key + 1
        RETURNING next_key - 1 AS key
        "#,
    )
    .bind(partition_id)
    .fetch_one(pool)
    .await?;

    use sqlx::Row;
    Ok(row.get::<i64, _>("key"))
}
