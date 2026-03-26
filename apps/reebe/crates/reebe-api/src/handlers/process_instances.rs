use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use reebe_db::state::process_instances::ProcessInstanceRepository;
use reebe_db::state::incidents::IncidentRepository;
use reebe_db::state::element_instances::ElementInstanceRepository;
use reebe_db::state::batch_operations::{BatchOperation, BatchOperationRepository};
use crate::app::ApiState;
use crate::dto::process_instances::{
    CreateProcessInstanceRequest,
    ProcessInstanceDto, SearchProcessInstancesRequest,
};
use crate::dto::incidents::IncidentDto;
use crate::error::{ApiError, ApiResult};
use crate::pagination::{PageRequest, PageResponse};
use crate::tenant::tenant_from_headers;

pub async fn create_process_instance(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateProcessInstanceRequest>,
) -> ApiResult<impl IntoResponse> {
    let header_tenant = tenant_from_headers(&headers);
    let tenant_id = if header_tenant != "<default>" {
        header_tenant
    } else {
        req.tenant_id.unwrap_or_else(|| "<default>".to_string())
    };

    let mut payload = serde_json::json!({
        "tenantId": tenant_id,
    });

    if let Some(key) = &req.process_definition_key {
        payload["processDefinitionKey"] = serde_json::Value::String(key.clone());
    }
    if let Some(id) = &req.bpmn_process_id {
        payload["bpmnProcessId"] = serde_json::Value::String(id.clone());
    }
    if let Some(version) = req.version {
        payload["version"] = serde_json::Value::Number(version.into());
    }
    if let Some(vars) = &req.variables {
        payload["variables"] = vars.clone();
    }

    let response = state
        .engine
        .send_command(
            "PROCESS_INSTANCE_CREATION".to_string(),
            "CREATE".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::OK, Json(response)))
}

pub async fn get_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let pi = repo.get_by_key(key_i64).await.map_err(|_e| {
        ApiError::NotFound {
            resource: "process instance".to_string(),
            key: key.clone(),
        }
    })?;

    Ok(Json(ProcessInstanceDto::from(pi)))
}

pub async fn search_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<SearchProcessInstancesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();

    let filter = req.filter.unwrap_or_default();

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let instances = repo
        .search(
            filter.state.as_deref(),
            filter.bpmn_process_id.as_deref(),
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = instances.first().map(|i| i.key);
    let last_key = instances.last().map(|i| i.key);
    let dtos: Vec<ProcessInstanceDto> = instances.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

pub async fn cancel_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let _key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let payload = serde_json::json!({
        "processInstanceKey": key,
    });

    state
        .engine
        .send_command(
            "PROCESS_INSTANCE".to_string(),
            "CANCEL".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn batch_cancel_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let batch_key = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    // Collect instance keys from request filter
    let instance_keys: Vec<i64> = req
        .get("filter")
        .and_then(|f| f.get("processInstanceKeys"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                .collect()
        })
        .unwrap_or_default();

    let items_count = instance_keys.len() as i64;

    // Insert batch operation record
    let batch_repo = BatchOperationRepository::new(&state.pool);
    let batch_op = BatchOperation {
        key: batch_key,
        operation_type: "CANCEL_PROCESS_INSTANCE".to_string(),
        state: "ACTIVE".to_string(),
        items_count,
        completed_items: 0,
        failed_items: 0,
        error_message: None,
        created_at: chrono::Utc::now(),
        completed_at: None,
    };
    batch_repo
        .insert(&batch_op)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let mut completed = 0i64;
    let mut failed = 0i64;

    for key in &instance_keys {
        let payload = serde_json::json!({ "processInstanceKey": key.to_string() });
        match state
            .engine
            .send_command(
                "PROCESS_INSTANCE".to_string(),
                "CANCEL".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
        {
            Ok(_) => completed += 1,
            Err(_) => failed += 1,
        }
    }

    batch_repo
        .update_progress(batch_key, completed, failed)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;
    batch_repo
        .mark_completed(batch_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    Ok(Json(json!({ "batchOperationKey": batch_key.to_string() })))
}

pub async fn delete_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let batch_key = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let instance_keys: Vec<i64> = req
        .get("filter")
        .and_then(|f| f.get("processInstanceKeys"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                .collect()
        })
        .unwrap_or_default();

    let items_count = instance_keys.len() as i64;

    let batch_repo = BatchOperationRepository::new(&state.pool);
    let batch_op = BatchOperation {
        key: batch_key,
        operation_type: "DELETE_PROCESS_INSTANCE".to_string(),
        state: "ACTIVE".to_string(),
        items_count,
        completed_items: 0,
        failed_items: 0,
        error_message: None,
        created_at: chrono::Utc::now(),
        completed_at: None,
    };
    batch_repo
        .insert(&batch_op)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let mut completed = 0i64;
    let mut failed = 0i64;

    for key in &instance_keys {
        let payload = serde_json::json!({ "processInstanceKey": key.to_string() });
        match state
            .engine
            .send_command(
                "PROCESS_INSTANCE".to_string(),
                "CANCEL".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
        {
            Ok(_) => completed += 1,
            Err(_) => failed += 1,
        }
    }

    batch_repo
        .update_progress(batch_key, completed, failed)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;
    batch_repo
        .mark_completed(batch_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    Ok(Json(json!({ "batchOperationKey": batch_key.to_string() })))
}

pub async fn batch_migrate_process_instances(
    State(_state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "title": "Not Implemented",
            "status": 501,
            "detail": "Batch migration not yet implemented"
        })),
    )
}

pub async fn migrate_process_instance() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "type": "about:blank",
            "title": "Not Implemented",
            "status": 501,
            "detail": "This endpoint is not yet implemented"
        })),
    )
}

pub async fn modify_process_instance() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "type": "about:blank",
            "title": "Not Implemented",
            "status": 501,
            "detail": "This endpoint is not yet implemented"
        })),
    )
}

pub async fn resolve_incident_for_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let repo = IncidentRepository::new(&state.pool);
    let incidents = repo
        .get_by_process_instance(key_i64)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let active_incidents: Vec<_> = incidents
        .into_iter()
        .filter(|i| i.state == "CREATED" || i.state == "ACTIVE")
        .collect();

    for incident in &active_incidents {
        let payload = serde_json::json!({
            "incidentKey": incident.key.to_string(),
        });
        state
            .engine
            .send_command(
                "INCIDENT".to_string(),
                "RESOLVE".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
            .map_err(ApiError::EngineError)?;
    }

    Ok(Json(json!({
        "resolvedIncidents": active_incidents.len()
    })))
}

pub async fn get_call_hierarchy(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let pi = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "process instance".to_string(),
        key: key.clone(),
    })?;

    // Walk up parent chain
    let parent_info = if let Some(parent_key) = pi.parent_process_instance_key {
        match repo.get_by_key(parent_key).await {
            Ok(parent) => Some(json!({
                "key": parent.key.to_string(),
                "bpmnProcessId": parent.bpmn_process_id,
            })),
            Err(_) => None,
        }
    } else {
        None
    };

    // Find children (instances whose parent_process_instance_key == key_i64)
    let children = repo
        .search(None, None, None, 100, None)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?
        .into_iter()
        .filter(|child| child.parent_process_instance_key == Some(key_i64))
        .map(|child| json!({
            "key": child.key.to_string(),
            "bpmnProcessId": child.bpmn_process_id,
        }))
        .collect::<Vec<_>>();

    Ok(Json(json!({
        "key": pi.key.to_string(),
        "bpmnProcessId": pi.bpmn_process_id,
        "parent": parent_info,
        "children": children,
    })))
}

pub async fn get_sequence_flows(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ElementInstanceRepository::new(pool);
    let elements = repo
        .get_by_process_instance(key_i64)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let sequence: Vec<_> = elements
        .into_iter()
        .filter(|e| e.state == "COMPLETED" || e.state == "ACTIVE")
        .map(|e| json!({
            "elementInstanceKey": e.key.to_string(),
            "elementId": e.element_id,
            "elementType": e.element_type,
            "state": e.state,
        }))
        .collect();

    Ok(Json(json!({ "items": sequence })))
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchIncidentsForInstanceRequest {
    pub filter: Option<InstanceIncidentFilter>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceIncidentFilter {
    pub state: Option<String>,
    pub error_type: Option<String>,
}

pub async fn search_process_instance_incidents(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<SearchIncidentsForInstanceRequest>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let repo = IncidentRepository::new(&state.pool);
    let incidents = repo
        .search(
            filter.state.as_deref(),
            filter.error_type.as_deref(),
            Some(key_i64),
            None,
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = incidents.first().map(|i| i.key);
    let last_key = incidents.last().map(|i| i.key);
    let dtos: Vec<IncidentDto> = incidents.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
