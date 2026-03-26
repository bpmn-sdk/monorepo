use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateExpressionRequest {
    pub expression: String,
    pub variables: Option<serde_json::Value>,
}

pub async fn evaluate_expression(
    State(_state): State<ApiState>,
    Json(req): Json<EvaluateExpressionRequest>,
) -> ApiResult<impl IntoResponse> {
    // Stub: return the expression as-is since there's no reebe_feel crate yet
    let _ = req.variables;
    Err::<axum::Json<serde_json::Value>, _>(ApiError::InvalidRequest(format!(
        "Expression evaluation not yet implemented for: {}",
        req.expression
    )))
}
