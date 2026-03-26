use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::messages::MessageSubscriptionRepository;
use crate::app::ApiState;
use crate::dto::messages::{PublishMessageRequest, CorrelateMessageRequest};
use crate::error::{ApiError, ApiResult};
use crate::pagination::{PageRequest, PageResponse};
use serde::{Deserialize, Serialize};

pub async fn publish_message(
    State(state): State<ApiState>,
    Json(req): Json<PublishMessageRequest>,
) -> ApiResult<impl IntoResponse> {
    let tenant_id = req.tenant_id.unwrap_or_else(|| "<default>".to_string());

    let payload = serde_json::json!({
        "messageName": req.message_name,
        "correlationKey": req.correlation_key.unwrap_or_default(),
        "timeToLive": req.time_to_live.unwrap_or(3600000),
        "messageId": req.message_id.unwrap_or_default(),
        "variables": req.variables.unwrap_or_default(),
        "tenantId": tenant_id,
    });

    let response = state
        .engine
        .send_command(
            "MESSAGE".to_string(),
            "PUBLISH".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn correlate_message(
    State(state): State<ApiState>,
    Json(req): Json<CorrelateMessageRequest>,
) -> ApiResult<impl IntoResponse> {
    let tenant_id = req.tenant_id.unwrap_or_else(|| "<default>".to_string());

    let payload = serde_json::json!({
        "messageName": req.message_name,
        "correlationKey": req.correlation_key.unwrap_or_default(),
        "variables": req.variables.unwrap_or_default(),
        "tenantId": tenant_id,
    });

    let response = state
        .engine
        .send_command(
            "MESSAGE".to_string(),
            "CORRELATE".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(Json(response))
}

// ---- Message subscriptions ----

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMessageSubscriptionsRequest {
    pub filter: Option<MessageSubscriptionFilter>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSubscriptionFilter {
    pub message_name: Option<String>,
    pub state: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSubscriptionDto {
    pub key: String,
    pub message_name: String,
    pub correlation_key: String,
    pub process_instance_key: String,
    pub element_instance_key: String,
    pub state: String,
    pub tenant_id: String,
}

impl From<reebe_db::state::messages::MessageSubscription> for MessageSubscriptionDto {
    fn from(s: reebe_db::state::messages::MessageSubscription) -> Self {
        Self {
            key: s.key.to_string(),
            message_name: s.message_name,
            correlation_key: s.correlation_key,
            process_instance_key: s.process_instance_key.to_string(),
            element_instance_key: s.element_instance_key.to_string(),
            state: s.state,
            tenant_id: s.tenant_id,
        }
    }
}

pub async fn search_message_subscriptions(
    State(state): State<ApiState>,
    Json(req): Json<SearchMessageSubscriptionsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = MessageSubscriptionRepository::new(pool);
    let subs = repo
        .search(
            filter.message_name.as_deref(),
            filter.state.as_deref(),
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = subs.first().map(|s| s.key);
    let last_key = subs.last().map(|s| s.key);
    let dtos: Vec<MessageSubscriptionDto> = subs.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
