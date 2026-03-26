use axum::extract::State;
use axum::extract::Multipart;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use base64::Engine as Base64Engine;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};
use crate::tenant::tenant_from_headers;

pub async fn create_deployment(
    State(state): State<ApiState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> ApiResult<impl IntoResponse> {
    let mut resources = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        ApiError::InvalidRequest(format!("Multipart error: {e}"))
    })? {
        let name = field
            .file_name()
            .unwrap_or("process.bpmn")
            .to_string();
        let data = field.bytes().await.map_err(|e| {
            ApiError::InvalidRequest(format!("Field read error: {e}"))
        })?;
        resources.push((name, data));
    }

    let payload = serde_json::json!({
        "resources": resources.iter().map(|(name, data)| {
            serde_json::json!({
                "name": name,
                "content": base64::engine::general_purpose::STANDARD.encode(data)
            })
        }).collect::<Vec<_>>()
    });

    let tenant_id = tenant_from_headers(&headers);
    let response = state
        .engine
        .send_command(
            "DEPLOYMENT".to_string(),
            "CREATE".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}
