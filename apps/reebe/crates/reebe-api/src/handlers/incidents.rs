use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::incidents::IncidentRepository;
use crate::app::ApiState;
use crate::dto::incidents::{IncidentDto, SearchIncidentsRequest};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn get_incident(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = IncidentRepository::new(pool);
    let incident = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "incident".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(IncidentDto::from(incident)))
}

pub async fn search_incidents(
    State(state): State<ApiState>,
    Json(req): Json<SearchIncidentsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let process_instance_key: Option<i64> = filter
        .process_instance_key
        .as_deref()
        .and_then(|s| s.parse().ok());

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = IncidentRepository::new(pool);
    let incidents = repo
        .search(
            filter.state.as_deref(),
            filter.error_type.as_deref(),
            process_instance_key,
            filter.tenant_id.as_deref(),
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

pub async fn resolve_incident(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "incidentKey": key,
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

    Ok(StatusCode::NO_CONTENT)
}
