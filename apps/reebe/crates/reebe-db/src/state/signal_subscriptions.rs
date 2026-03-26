#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use serde::{Deserialize, Serialize};
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalSubscription {
    pub key: i64,
    pub signal_name: String,
    pub process_instance_key: i64,
    pub element_instance_key: i64,
    pub element_id: String,
    pub bpmn_process_id: String,
    pub process_definition_key: i64,
    pub flow_scope_key: i64,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct SignalSubscriptionRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> SignalSubscriptionRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, sub: &SignalSubscription) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO signal_subscriptions
               (key, signal_name, process_instance_key, element_instance_key, element_id,
                bpmn_process_id, process_definition_key, flow_scope_key, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(sub.key)
        .bind(&sub.signal_name)
        .bind(sub.process_instance_key)
        .bind(sub.element_instance_key)
        .bind(&sub.element_id)
        .bind(&sub.bpmn_process_id)
        .bind(sub.process_definition_key)
        .bind(sub.flow_scope_key)
        .bind(&sub.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_signal_name(
        &self,
        signal_name: &str,
        tenant_id: &str,
    ) -> Result<Vec<SignalSubscription>> {
        let rows = sqlx::query(
            r#"SELECT key, signal_name, process_instance_key, element_instance_key, element_id,
                      bpmn_process_id, process_definition_key, flow_scope_key, tenant_id
               FROM signal_subscriptions
               WHERE signal_name = $1 AND tenant_id = $2
               ORDER BY key"#,
        )
        .bind(signal_name)
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows.into_iter().map(|r| SignalSubscription {
            key: r.get("key"),
            signal_name: r.get("signal_name"),
            process_instance_key: r.get("process_instance_key"),
            element_instance_key: r.get("element_instance_key"),
            element_id: r.get("element_id"),
            bpmn_process_id: r.get("bpmn_process_id"),
            process_definition_key: r.get("process_definition_key"),
            flow_scope_key: r.get("flow_scope_key"),
            tenant_id: r.get("tenant_id"),
        }).collect())
    }

    pub async fn delete(&self, key: i64) -> Result<()> {
        sqlx::query("DELETE FROM signal_subscriptions WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_by_process_instance(&self, process_instance_key: i64) -> Result<()> {
        sqlx::query("DELETE FROM signal_subscriptions WHERE process_instance_key = $1")
            .bind(process_instance_key)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
