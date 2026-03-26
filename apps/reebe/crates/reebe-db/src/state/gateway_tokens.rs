#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use crate::Result;

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct GatewayTokenRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> GatewayTokenRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    /// Atomically increment the token count for a gateway and return the new value.
    pub async fn increment_and_get(
        &self,
        process_instance_key: i64,
        element_id: &str,
    ) -> Result<i32> {
        let row = sqlx::query(
            r#"INSERT INTO gateway_tokens (process_instance_key, element_id, token_count)
               VALUES ($1, $2, 1)
               ON CONFLICT (process_instance_key, element_id)
               DO UPDATE SET token_count = gateway_tokens.token_count + 1
               RETURNING token_count"#,
        )
        .bind(process_instance_key)
        .bind(element_id)
        .fetch_one(self.pool)
        .await?;

        use sqlx::Row;
        Ok(row.get("token_count"))
    }

    pub async fn delete(
        &self,
        process_instance_key: i64,
        element_id: &str,
    ) -> Result<()> {
        sqlx::query(
            "DELETE FROM gateway_tokens WHERE process_instance_key = $1 AND element_id = $2",
        )
        .bind(process_instance_key)
        .bind(element_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_by_process_instance(
        &self,
        process_instance_key: i64,
    ) -> Result<()> {
        sqlx::query("DELETE FROM gateway_tokens WHERE process_instance_key = $1")
            .bind(process_instance_key)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
