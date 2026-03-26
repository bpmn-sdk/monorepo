use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use crate::app::ApiState;
use crate::dto::signals::BroadcastSignalRequest;
use crate::error::{ApiError, ApiResult};

pub async fn broadcast(
    State(state): State<ApiState>,
    Json(req): Json<BroadcastSignalRequest>,
) -> ApiResult<impl IntoResponse> {
    let tenant_id = req.tenant_id.unwrap_or_else(|| "<default>".to_string());

    let payload = serde_json::json!({
        "signalName": req.signal_name,
        "variables": req.variables.unwrap_or_default(),
        "tenantId": tenant_id,
    });

    let response = state
        .engine
        .send_command(
            "SIGNAL".to_string(),
            "BROADCAST".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}
