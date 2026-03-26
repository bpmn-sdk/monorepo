use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::variables::VariableRepository;
use crate::app::ApiState;
use crate::dto::variables::{SearchVariablesRequest, VariableDto};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn get_variable(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    // Search by key in variable table
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = VariableRepository::new(pool);
    let variables = repo
        .search(None, None, None, None, 1, Some(key_i64 - 1))
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let variable = variables
        .into_iter()
        .find(|v| v.key == key_i64)
        .ok_or_else(|| ApiError::NotFound {
            resource: "variable".to_string(),
            key: key.clone(),
        })?;

    Ok(Json(VariableDto::from(variable)))
}

pub async fn search_variables(
    State(state): State<ApiState>,
    Json(req): Json<SearchVariablesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let scope_key: Option<i64> = filter.scope_key.as_deref().and_then(|s| s.parse().ok());
    let process_instance_key: Option<i64> =
        filter.process_instance_key.as_deref().and_then(|s| s.parse().ok());

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = VariableRepository::new(pool);
    let variables = repo
        .search(
            process_instance_key,
            scope_key,
            filter.name.as_deref(),
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = variables.first().map(|v| v.key);
    let last_key = variables.last().map(|v| v.key);
    let dtos: Vec<VariableDto> = variables.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
