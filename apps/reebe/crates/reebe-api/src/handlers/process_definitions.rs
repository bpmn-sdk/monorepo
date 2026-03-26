use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::deployments::DeploymentRepository;
use crate::app::ApiState;
use crate::dto::process_definitions::{ProcessDefinitionDto, SearchProcessDefinitionsRequest};
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
    let repo = DeploymentRepository::new(pool);
    let pd = repo.get_process_definition_by_key(key_i64).await.map_err(|_| {
        ApiError::NotFound {
            resource: "process definition".to_string(),
            key: key.clone(),
        }
    })?;

    Ok(Json(ProcessDefinitionDto::from(pd)))
}

pub async fn get_xml(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = DeploymentRepository::new(pool);
    let xml = repo.get_process_definition_xml(key_i64).await.map_err(|_| {
        ApiError::NotFound {
            resource: "process definition".to_string(),
            key: key.clone(),
        }
    })?;

    Ok(axum::response::Response::builder()
        .status(200)
        .header("content-type", "application/xml")
        .body(axum::body::Body::from(xml))
        .unwrap())
}

pub async fn search(
    State(state): State<ApiState>,
    Json(req): Json<SearchProcessDefinitionsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = DeploymentRepository::new(pool);
    let pds = repo
        .search_process_definitions(
            filter.bpmn_process_id.as_deref(),
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = pds.first().map(|p| p.key);
    let last_key = pds.last().map(|p| p.key);
    let dtos: Vec<ProcessDefinitionDto> = pds.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
