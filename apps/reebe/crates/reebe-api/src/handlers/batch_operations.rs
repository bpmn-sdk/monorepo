use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use reebe_db::state::batch_operations::BatchOperationRepository;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};

pub async fn search_batch_operations(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let page_size = req
        .get("page")
        .and_then(|p| p.get("limit"))
        .and_then(|v| v.as_i64())
        .unwrap_or(20);
    let after_key = req
        .get("page")
        .and_then(|p| p.get("searchAfter"))
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())));

    let repo = BatchOperationRepository::new(&state.pool);
    let ops = repo
        .search(page_size, after_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let items: Vec<serde_json::Value> = ops
        .iter()
        .map(|op| {
            json!({
                "batchOperationKey": op.key.to_string(),
                "operationType": op.operation_type,
                "state": op.state,
                "itemsCount": op.items_count,
                "completedItems": op.completed_items,
                "failedItems": op.failed_items,
                "errorMessage": op.error_message,
                "createdAt": op.created_at,
                "completedAt": op.completed_at,
            })
        })
        .collect();

    let total = items.len();
    Ok(Json(json!({
        "items": items,
        "page": { "totalItems": total }
    })))
}

pub async fn get_batch_operation(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key
        .parse()
        .map_err(|_| ApiError::InvalidRequest(format!("Invalid key: {key}")))?;

    let repo = BatchOperationRepository::new(&state.pool);
    let op = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "batch operation".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(json!({
        "batchOperationKey": op.key.to_string(),
        "operationType": op.operation_type,
        "state": op.state,
        "itemsCount": op.items_count,
        "completedItems": op.completed_items,
        "failedItems": op.failed_items,
        "errorMessage": op.error_message,
        "createdAt": op.created_at,
        "completedAt": op.completed_at,
    })))
}
