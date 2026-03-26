#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deployment {
    pub key: i64,
    pub tenant_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessDefinition {
    pub key: i64,
    pub bpmn_process_id: String,
    pub version: i32,
    pub tenant_id: String,
    pub deployment_key: i64,
    pub resource_name: String,
    pub bpmn_xml: String,
    pub bpmn_checksum: Option<Vec<u8>>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct DeploymentRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> DeploymentRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert_deployment(&self, deployment: &Deployment) -> Result<()> {
        sqlx::query(
            "INSERT INTO deployments (key, tenant_id, created_at) VALUES ($1, $2, $3)",
        )
        .bind(deployment.key)
        .bind(&deployment.tenant_id)
        .bind(deployment.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn insert_process_definition(&self, pd: &ProcessDefinition) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO process_definitions
               (key, bpmn_process_id, version, tenant_id, deployment_key, resource_name, bpmn_xml, bpmn_checksum)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (bpmn_process_id, version, tenant_id) DO NOTHING"#,
        )
        .bind(pd.key)
        .bind(&pd.bpmn_process_id)
        .bind(pd.version)
        .bind(&pd.tenant_id)
        .bind(pd.deployment_key)
        .bind(&pd.resource_name)
        .bind(&pd.bpmn_xml)
        .bind(&pd.bpmn_checksum)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_process_definition_by_key(&self, key: i64) -> Result<ProcessDefinition> {
        let row = sqlx::query(
            r#"SELECT key, bpmn_process_id, version, tenant_id, deployment_key,
                      resource_name, bpmn_xml, bpmn_checksum
               FROM process_definitions WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_pd(r)),
            None => Err(DbError::NotFound(format!("Process definition {key}"))),
        }
    }

    pub async fn get_latest_process_definition(
        &self,
        bpmn_process_id: &str,
        tenant_id: &str,
    ) -> Result<ProcessDefinition> {
        let row = sqlx::query(
            r#"SELECT key, bpmn_process_id, version, tenant_id, deployment_key,
                      resource_name, bpmn_xml, bpmn_checksum
               FROM process_definitions
               WHERE bpmn_process_id = $1 AND tenant_id = $2
               ORDER BY version DESC
               LIMIT 1"#,
        )
        .bind(bpmn_process_id)
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_pd(r)),
            None => Err(DbError::NotFound(format!(
                "No process definition for bpmnProcessId={bpmn_process_id} tenant={tenant_id}"
            ))),
        }
    }

    pub async fn get_process_definition_xml(&self, key: i64) -> Result<String> {
        let row = sqlx::query(
            "SELECT bpmn_xml FROM process_definitions WHERE key = $1",
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(r.get("bpmn_xml")),
            None => Err(DbError::NotFound(format!("Process definition {key}"))),
        }
    }

    pub async fn get_by_id_and_version(
        &self,
        bpmn_process_id: &str,
        version: i32,
        tenant_id: &str,
    ) -> Result<ProcessDefinition> {
        let row = sqlx::query(
            r#"SELECT key, bpmn_process_id, version, tenant_id, deployment_key,
                      resource_name, bpmn_xml, bpmn_checksum
               FROM process_definitions
               WHERE bpmn_process_id = $1 AND version = $2 AND tenant_id = $3"#,
        )
        .bind(bpmn_process_id)
        .bind(version)
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_pd(r)),
            None => Err(DbError::NotFound(format!(
                "Process definition {bpmn_process_id} v{version} tenant={tenant_id}"
            ))),
        }
    }

    pub async fn search_process_definitions(
        &self,
        bpmn_process_id: Option<&str>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<ProcessDefinition>> {
        let rows = sqlx::query(
            r#"SELECT key, bpmn_process_id, version, tenant_id, deployment_key,
                      resource_name, bpmn_xml, bpmn_checksum
               FROM process_definitions
               WHERE ($1::text IS NULL OR bpmn_process_id = $1)
                 AND ($2::text IS NULL OR tenant_id = $2)
                 AND ($3::bigint IS NULL OR key > $3)
               ORDER BY key
               LIMIT $4"#,
        )
        .bind(bpmn_process_id)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_pd(r)).collect())
    }

    pub async fn get_deployment_by_key(&self, key: i64) -> Result<Deployment> {
        let row = sqlx::query(
            "SELECT key, tenant_id, created_at FROM deployments WHERE key = $1",
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        use sqlx::Row;
        match row {
            Some(r) => Ok(Deployment {
                key: r.get("key"),
                tenant_id: r.get("tenant_id"),
                created_at: r.get("created_at"),
            }),
            None => Err(DbError::NotFound(format!("Deployment {key}"))),
        }
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_pd(r: crate::DbRow) -> ProcessDefinition {
    use sqlx::Row;
    ProcessDefinition {
        key: r.get("key"),
        bpmn_process_id: r.get("bpmn_process_id"),
        version: r.get("version"),
        tenant_id: r.get("tenant_id"),
        deployment_key: r.get("deployment_key"),
        resource_name: r.get("resource_name"),
        bpmn_xml: r.get("bpmn_xml"),
        bpmn_checksum: r.get("bpmn_checksum"),
    }
}
