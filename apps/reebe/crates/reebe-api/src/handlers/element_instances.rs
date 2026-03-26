use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::element_instances::ElementInstanceRepository;
use crate::app::ApiState;
use crate::dto::element_instances::{ElementInstanceDto, SearchElementInstancesRequest};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn get(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ElementInstanceRepository::new(pool);
    let ei = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "element instance".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(ElementInstanceDto::from(ei)))
}

pub async fn search(
    State(state): State<ApiState>,
    Json(req): Json<SearchElementInstancesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let _after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let process_instance_key: Option<i64> = filter
        .process_instance_key
        .as_deref()
        .and_then(|s| s.parse().ok());

    // We use get_by_process_instance if key provided, otherwise return empty
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let eis = if let Some(pi_key) = process_instance_key {
        let repo = ElementInstanceRepository::new(pool);
        repo.get_by_process_instance(pi_key)
            .await
            .map_err(|e| ApiError::InternalError(e.to_string()))?
    } else {
        vec![]
    };

    let first_key = eis.first().map(|e| e.key);
    let last_key = eis.last().map(|e| e.key);
    let dtos: Vec<ElementInstanceDto> = eis.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
