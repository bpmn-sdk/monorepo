use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use sqlx::Row;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};

pub async fn element_instance_statistics(
    State(state): State<ApiState>,
    Path(key): Path<i64>,
) -> ApiResult<impl IntoResponse> {
    // Get active, completed, terminated counts per element_id
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let rows = sqlx::query(
        r#"SELECT ei.element_id,
               COUNT(*) FILTER (WHERE ei.state = 'ACTIVE') as active,
               COUNT(*) FILTER (WHERE ei.state = 'COMPLETED') as completed,
               COUNT(*) FILTER (WHERE ei.state = 'TERMINATED') as terminated
           FROM element_instances ei
           JOIN process_instances pi ON pi.key = ei.process_instance_key
           WHERE pi.process_definition_key = $1
           GROUP BY ei.element_id"#,
    )
    .bind(key)
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    // Get incident counts per element_id for this process definition
    let incident_rows = sqlx::query(
        r#"SELECT ei.element_id, COUNT(i.key) as incidents
           FROM incidents i
           JOIN element_instances ei ON ei.key = i.element_instance_key
           JOIN process_instances pi ON pi.key = i.process_instance_key
           WHERE pi.process_definition_key = $1 AND i.state = 'ACTIVE'
           GROUP BY ei.element_id"#,
    )
    .bind(key)
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    // Build incident map
    let mut incident_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for row in &incident_rows {
        let element_id: String = row.get("element_id");
        let incidents: i64 = row.get("incidents");
        incident_map.insert(element_id, incidents);
    }

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let element_id: String = row.get("element_id");
            let active: i64 = row.get("active");
            let completed: i64 = row.get("completed");
            let terminated: i64 = row.get("terminated");
            let incidents = incident_map.get(&element_id).copied().unwrap_or(0);
            json!({
                "elementId": element_id,
                "active": active,
                "incidents": incidents,
                "completed": completed,
                "terminated": terminated,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}

pub async fn incidents_by_definition(
    State(state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let rows = sqlx::query(
        r#"SELECT pd.key as process_definition_key,
               pd.bpmn_process_id as name,
               pd.version,
               COUNT(DISTINCT pi.key) as process_definitions_with_active_incidents,
               COUNT(i.key) as active_incidents
           FROM incidents i
           JOIN process_instances pi ON pi.key = i.process_instance_key
           JOIN process_definitions pd ON pd.key = pi.process_definition_key
           WHERE i.state = 'ACTIVE'
           GROUP BY pd.key, pd.bpmn_process_id, pd.version"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let process_definition_key: i64 = row.get("process_definition_key");
            let name: String = row.get("name");
            let version: i32 = row.get("version");
            let process_definitions_with_active_incidents: i64 =
                row.get("process_definitions_with_active_incidents");
            let active_incidents: i64 = row.get("active_incidents");
            json!({
                "processDefinitionKey": process_definition_key,
                "name": name,
                "version": version,
                "processDefinitionsWithActiveIncidents": process_definitions_with_active_incidents,
                "activeIncidents": active_incidents,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}

pub async fn incidents_by_error(
    State(state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let rows = sqlx::query(
        r#"SELECT i.error_message,
               pd.key as process_definition_key,
               pd.bpmn_process_id as name,
               pd.version,
               COUNT(DISTINCT i.process_instance_key) as instances_with_active_incidents
           FROM incidents i
           JOIN process_instances pi ON pi.key = i.process_instance_key
           JOIN process_definitions pd ON pd.key = pi.process_definition_key
           WHERE i.state = 'ACTIVE'
           GROUP BY i.error_message, pd.key, pd.bpmn_process_id, pd.version"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let error_message: Option<String> = row.get("error_message");
            let process_definition_key: i64 = row.get("process_definition_key");
            let name: String = row.get("name");
            let version: i32 = row.get("version");
            let instances_with_active_incidents: i64 = row.get("instances_with_active_incidents");
            json!({
                "errorMessage": error_message,
                "processDefinitionKey": process_definition_key,
                "name": name,
                "version": version,
                "instancesWithActiveIncidents": instances_with_active_incidents,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}

pub async fn jobs_statistics_global(
    State(state): State<ApiState>,
) -> ApiResult<impl IntoResponse> {
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let row = sqlx::query(
        r#"SELECT
               COUNT(*) FILTER (WHERE state = 'ACTIVATABLE') as activatable,
               COUNT(*) FILTER (WHERE state = 'ACTIVATED') as active,
               COUNT(*) FILTER (WHERE state = 'FAILED') as failed,
               COUNT(*) FILTER (WHERE state = 'COMPLETED') as completed
           FROM jobs"#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let activatable: i64 = row.get("activatable");
    let active: i64 = row.get("active");
    let failed: i64 = row.get("failed");
    let completed: i64 = row.get("completed");

    Ok(Json(json!({
        "activatable": activatable,
        "active": active,
        "failed": failed,
        "completed": completed,
    })))
}

pub async fn jobs_statistics_by_type(
    State(state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let rows = sqlx::query(
        r#"SELECT job_type,
               COUNT(*) FILTER (WHERE state = 'ACTIVATABLE') as activatable,
               COUNT(*) FILTER (WHERE state = 'ACTIVATED') as active,
               COUNT(*) FILTER (WHERE state = 'FAILED') as failed,
               COUNT(*) FILTER (WHERE state = 'COMPLETED') as completed
           FROM jobs
           GROUP BY job_type"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let job_type: String = row.get("job_type");
            let activatable: i64 = row.get("activatable");
            let active: i64 = row.get("active");
            let failed: i64 = row.get("failed");
            let completed: i64 = row.get("completed");
            json!({
                "type": job_type,
                "activatable": activatable,
                "active": active,
                "failed": failed,
                "completed": completed,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}

pub async fn jobs_statistics_by_worker(
    State(state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let rows = sqlx::query(
        r#"SELECT COALESCE(worker, 'unknown') as worker,
               COUNT(*) FILTER (WHERE state = 'ACTIVATABLE') as activatable,
               COUNT(*) FILTER (WHERE state = 'ACTIVATED') as active,
               COUNT(*) FILTER (WHERE state = 'FAILED') as failed,
               COUNT(*) FILTER (WHERE state = 'COMPLETED') as completed
           FROM jobs
           GROUP BY worker"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let worker: String = row.get("worker");
            let activatable: i64 = row.get("activatable");
            let active: i64 = row.get("active");
            let failed: i64 = row.get("failed");
            let completed: i64 = row.get("completed");
            json!({
                "worker": worker,
                "activatable": activatable,
                "active": active,
                "failed": failed,
                "completed": completed,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}
