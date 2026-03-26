use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use crate::app::ApiState;
use crate::dto::system::ClockResponse;
use crate::error::ApiResult;

pub async fn get_clock(State(_state): State<ApiState>) -> ApiResult<impl IntoResponse> {
    let now = chrono::Utc::now();
    Ok(Json(ClockResponse {
        epoch_millis: now.timestamp_millis(),
        instant: now.to_rfc3339(),
    }))
}

pub async fn pin_clock(
    State(_state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

pub async fn reset_clock(State(_state): State<ApiState>) -> impl IntoResponse {
    StatusCode::NO_CONTENT
}
