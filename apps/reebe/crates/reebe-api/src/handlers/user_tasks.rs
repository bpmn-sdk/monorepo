use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::user_tasks::UserTaskRepository;
use crate::app::ApiState;
use crate::dto::user_tasks::{
    AssignUserTaskRequest, CompleteUserTaskRequest,
    SearchUserTasksRequest, UserTaskDto,
};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn get_user_task(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = UserTaskRepository::new(pool);
    let task = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "user task".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(UserTaskDto::from(task)))
}

pub async fn search_user_tasks(
    State(state): State<ApiState>,
    Json(req): Json<SearchUserTasksRequest>,
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
    let repo = UserTaskRepository::new(pool);
    let tasks = repo
        .search(
            filter.state.as_deref(),
            filter.assignee.as_deref(),
            process_instance_key,
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = tasks.first().map(|t| t.key);
    let last_key = tasks.last().map(|t| t.key);
    let dtos: Vec<UserTaskDto> = tasks.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

pub async fn complete_user_task(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<CompleteUserTaskRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "userTaskKey": key,
        "variables": req.variables.unwrap_or_default(),
    });

    state
        .engine
        .send_command(
            "USER_TASK".to_string(),
            "COMPLETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_user_task(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<AssignUserTaskRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "userTaskKey": key,
        "assignee": req.assignee,
    });

    state
        .engine
        .send_command(
            "USER_TASK".to_string(),
            "ASSIGN".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn unassign_user_task(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "userTaskKey": key,
        "assignee": null,
    });

    state
        .engine
        .send_command(
            "USER_TASK".to_string(),
            "UNASSIGN".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}
