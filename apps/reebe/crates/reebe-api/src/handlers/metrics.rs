//! Prometheus metrics endpoint handler.

use axum::response::{IntoResponse, Response};
use axum::http::{StatusCode, header};
use axum::extract::State;
use crate::app::ApiState;

pub async fn metrics_handler(
    State(state): State<ApiState>,
) -> Response {
    match state.metrics_handle.as_ref() {
        Some(handle) => {
            let output = handle.render();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
                output,
            ).into_response()
        }
        None => (StatusCode::SERVICE_UNAVAILABLE, "Metrics not initialized").into_response(),
    }
}
