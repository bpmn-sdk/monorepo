#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserTask {
    pub key: i64,
    pub partition_id: i16,
    pub process_instance_key: i64,
    pub element_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub element_id: String,
    pub state: String,
    pub assignee: Option<String>,
    pub candidate_groups: Option<Vec<String>>,
    pub candidate_users: Option<Vec<String>>,
    pub due_date: Option<DateTime<Utc>>,
    pub follow_up_date: Option<DateTime<Utc>>,
    pub form_key: Option<String>,
    pub custom_headers: Value,
    pub variables: Value,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct UserTaskRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> UserTaskRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, task: &UserTask) -> Result<()> {
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"INSERT INTO user_tasks
               (key, partition_id, process_instance_key, element_instance_key,
                process_definition_key, bpmn_process_id, element_id, state, assignee,
                candidate_groups, candidate_users, due_date, follow_up_date, form_key,
                custom_headers, variables, created_at, tenant_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)"#,
        )
        .bind(task.key)
        .bind(task.partition_id)
        .bind(task.process_instance_key)
        .bind(task.element_instance_key)
        .bind(task.process_definition_key)
        .bind(&task.bpmn_process_id)
        .bind(&task.element_id)
        .bind(&task.state)
        .bind(&task.assignee)
        .bind(&task.candidate_groups)
        .bind(&task.candidate_users)
        .bind(task.due_date)
        .bind(task.follow_up_date)
        .bind(&task.form_key)
        .bind(&task.custom_headers)
        .bind(&task.variables)
        .bind(task.created_at)
        .bind(&task.tenant_id)
        .execute(self.pool)
        .await?;

        #[cfg(feature = "sqlite")]
        sqlx::query(
            r#"INSERT INTO user_tasks
               (key, partition_id, process_instance_key, element_instance_key,
                process_definition_key, bpmn_process_id, element_id, state, assignee,
                candidate_groups, candidate_users, due_date, follow_up_date, form_key,
                custom_headers, variables, created_at, tenant_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)"#,
        )
        .bind(task.key)
        .bind(task.partition_id as i32)
        .bind(task.process_instance_key)
        .bind(task.element_instance_key)
        .bind(task.process_definition_key)
        .bind(&task.bpmn_process_id)
        .bind(&task.element_id)
        .bind(&task.state)
        .bind(&task.assignee)
        .bind(serialize_string_vec(&task.candidate_groups))
        .bind(serialize_string_vec(&task.candidate_users))
        .bind(task.due_date.map(|d| d.to_rfc3339()))
        .bind(task.follow_up_date.map(|d| d.to_rfc3339()))
        .bind(&task.form_key)
        .bind(&task.custom_headers)
        .bind(&task.variables)
        .bind(task.created_at.to_rfc3339())
        .bind(&task.tenant_id)
        .execute(self.pool)
        .await?;

        Ok(())
    }

    pub async fn assign(&self, key: i64, assignee: Option<&str>) -> Result<()> {
        sqlx::query(
            "UPDATE user_tasks SET assignee = $1 WHERE key = $2",
        )
        .bind(assignee)
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn complete(&self, key: i64, variables: Option<Value>) -> Result<()> {
        let vars = variables.unwrap_or_else(|| Value::Object(Default::default()));

        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"UPDATE user_tasks SET state = 'COMPLETED', completed_at = NOW(), variables = $1
               WHERE key = $2"#,
        )
        .bind(&vars)
        .bind(key)
        .execute(self.pool)
        .await?;

        #[cfg(feature = "sqlite")]
        sqlx::query(
            r#"UPDATE user_tasks SET state = 'COMPLETED', completed_at = datetime('now'), variables = $1
               WHERE key = $2"#,
        )
        .bind(&vars)
        .bind(key)
        .execute(self.pool)
        .await?;

        Ok(())
    }

    pub async fn cancel(&self, key: i64) -> Result<()> {
        sqlx::query("UPDATE user_tasks SET state = 'CANCELED' WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<UserTask> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, element_instance_key,
                      process_definition_key, bpmn_process_id, element_id, state, assignee,
                      candidate_groups, candidate_users, due_date, follow_up_date, form_key,
                      custom_headers, variables, created_at, completed_at, tenant_id
               FROM user_tasks WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_user_task(r)),
            None => Err(DbError::NotFound(format!("User task {key}"))),
        }
    }

    pub async fn search(
        &self,
        state_filter: Option<&str>,
        assignee: Option<&str>,
        process_instance_key: Option<i64>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<UserTask>> {
        #[cfg(feature = "postgres")]
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, element_instance_key,
                      process_definition_key, bpmn_process_id, element_id, state, assignee,
                      candidate_groups, candidate_users, due_date, follow_up_date, form_key,
                      custom_headers, variables, created_at, completed_at, tenant_id
               FROM user_tasks
               WHERE ($1::text IS NULL OR state = $1)
                 AND ($2::text IS NULL OR assignee = $2)
                 AND ($3::bigint IS NULL OR process_instance_key = $3)
                 AND ($4::text IS NULL OR tenant_id = $4)
                 AND ($5::bigint IS NULL OR key > $5)
               ORDER BY key
               LIMIT $6"#,
        )
        .bind(state_filter)
        .bind(assignee)
        .bind(process_instance_key)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        #[cfg(feature = "sqlite")]
        let rows = sqlx::query(
            r#"SELECT key, partition_id, process_instance_key, element_instance_key,
                      process_definition_key, bpmn_process_id, element_id, state, assignee,
                      candidate_groups, candidate_users, due_date, follow_up_date, form_key,
                      custom_headers, variables, created_at, completed_at, tenant_id
               FROM user_tasks
               WHERE ($1 IS NULL OR state = $1)
                 AND ($2 IS NULL OR assignee = $2)
                 AND ($3 IS NULL OR process_instance_key = $3)
                 AND ($4 IS NULL OR tenant_id = $4)
                 AND ($5 IS NULL OR key > $5)
               ORDER BY key
               LIMIT $6"#,
        )
        .bind(state_filter)
        .bind(assignee)
        .bind(process_instance_key)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_user_task(r)).collect())
    }
}

#[cfg(feature = "sqlite")]
fn serialize_string_vec(v: &Option<Vec<String>>) -> Option<String> {
    v.as_ref().map(|arr| serde_json::to_string(arr).unwrap_or_else(|_| "[]".to_string()))
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_user_task(r: crate::DbRow) -> UserTask {
    use sqlx::Row;

    #[cfg(feature = "postgres")]
    return UserTask {
        key: r.get("key"),
        partition_id: r.get("partition_id"),
        process_instance_key: r.get("process_instance_key"),
        element_instance_key: r.get("element_instance_key"),
        process_definition_key: r.get("process_definition_key"),
        bpmn_process_id: r.get("bpmn_process_id"),
        element_id: r.get("element_id"),
        state: r.get("state"),
        assignee: r.get("assignee"),
        candidate_groups: r.get("candidate_groups"),
        candidate_users: r.get("candidate_users"),
        due_date: r.get("due_date"),
        follow_up_date: r.get("follow_up_date"),
        form_key: r.get("form_key"),
        custom_headers: r.get("custom_headers"),
        variables: r.get("variables"),
        created_at: r.get("created_at"),
        completed_at: r.get("completed_at"),
        tenant_id: r.get("tenant_id"),
    };

    #[cfg(feature = "sqlite")]
    {
        let candidate_groups: Option<Vec<String>> = r
            .get::<Option<String>, _>("candidate_groups")
            .and_then(|s| serde_json::from_str(&s).ok());
        let candidate_users: Option<Vec<String>> = r
            .get::<Option<String>, _>("candidate_users")
            .and_then(|s| serde_json::from_str(&s).ok());
        let due_date: Option<DateTime<Utc>> = r
            .get::<Option<String>, _>("due_date")
            .and_then(|s| s.parse().ok());
        let follow_up_date: Option<DateTime<Utc>> = r
            .get::<Option<String>, _>("follow_up_date")
            .and_then(|s| s.parse().ok());
        let created_at: DateTime<Utc> = r
            .get::<String, _>("created_at")
            .parse()
            .unwrap_or_else(|_| Utc::now());
        let completed_at: Option<DateTime<Utc>> = r
            .get::<Option<String>, _>("completed_at")
            .and_then(|s| s.parse().ok());
        let partition_id: i32 = r.get("partition_id");
        UserTask {
            key: r.get("key"),
            partition_id: partition_id as i16,
            process_instance_key: r.get("process_instance_key"),
            element_instance_key: r.get("element_instance_key"),
            process_definition_key: r.get("process_definition_key"),
            bpmn_process_id: r.get("bpmn_process_id"),
            element_id: r.get("element_id"),
            state: r.get("state"),
            assignee: r.get("assignee"),
            candidate_groups,
            candidate_users,
            due_date,
            follow_up_date,
            form_key: r.get("form_key"),
            custom_headers: r.get("custom_headers"),
            variables: r.get("variables"),
            created_at,
            completed_at,
            tenant_id: r.get("tenant_id"),
        }
    }
}
