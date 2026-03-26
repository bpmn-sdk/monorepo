use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;

fn not_implemented() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "type": "about:blank",
            "title": "Not Implemented",
            "status": 501,
            "detail": "This endpoint is not yet implemented"
        })),
    )
}

pub async fn get_resource() -> impl IntoResponse {
    not_implemented()
}

pub async fn delete_resource() -> impl IntoResponse {
    not_implemented()
}

pub async fn get_resource_content() -> impl IntoResponse {
    not_implemented()
}
