use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use crate::app::ApiState;
use crate::dto::system::{BrokerInfo, LicenseResponse, PartitionInfo, StatusResponse, TopologyResponse};
use crate::error::{ApiError, ApiResult};

pub async fn topology(State(state): State<ApiState>) -> ApiResult<impl IntoResponse> {
    let owned = state.engine.owned_partitions.read().await.clone();
    let partitions: Vec<PartitionInfo> = if owned.is_empty() {
        // Fallback: show partition 1 as per Zeebe convention if nothing owned yet
        vec![PartitionInfo {
            partition_id: 1,
            role: "LEADER".to_string(),
            health: "HEALTHY".to_string(),
        }]
    } else {
        owned
            .iter()
            .map(|&pid| PartitionInfo {
                partition_id: pid as i32,
                role: "LEADER".to_string(),
                health: "HEALTHY".to_string(),
            })
            .collect()
    };

    Ok(Json(TopologyResponse {
        brokers: vec![BrokerInfo {
            node_id: 0,
            host: "localhost".to_string(),
            port: 26501,
            partitions,
            version: env!("CARGO_PKG_VERSION").to_string(),
        }],
        gateway_version: env!("CARGO_PKG_VERSION").to_string(),
        cluster_size: 1,
        partitions_count: owned.len().max(1) as i32,
        replication_factor: 1,
    }))
}

pub async fn status(State(state): State<ApiState>) -> ApiResult<impl IntoResponse> {
    // Attempt a simple DB health check via sqlx pool ping
    let health = match state.pool.acquire().await {
        Ok(_) => "HEALTHY",
        Err(_) => "UNHEALTHY",
    };

    Ok(Json(StatusResponse {
        health: health.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }))
}

pub async fn license(State(_state): State<ApiState>) -> impl IntoResponse {
    Json(LicenseResponse {
        license_type: "production".to_string(),
        is_valid_license: true,
        expires_at: None,
    })
}

pub async fn get_configuration(State(_state): State<ApiState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "clusterSize": 1,
        "partitionsCount": 1,
        "replicationFactor": 1,
        "gatewayVersion": env!("CARGO_PKG_VERSION"),
        "brokers": []
    }))
}

pub async fn usage_metrics(
    State(_state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

pub async fn setup_user(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "username": req.get("username").and_then(|v| v.as_str()).unwrap_or("admin"),
        "name": req.get("name"),
        "email": req.get("email"),
        "passwordHash": req.get("password").and_then(|v| v.as_str()).map(|_| "SETUP"),
    });
    let _ = state
        .engine
        .send_command(
            "USER".to_string(),
            "CREATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError);
    Ok(StatusCode::NO_CONTENT)
}

/// Camunda-compatible health check endpoint (`GET /actuator/health`).
pub async fn actuator_health(State(state): State<ApiState>) -> impl IntoResponse {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    let status_str = if db_ok { "UP" } else { "DOWN" };
    let http_status = if db_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };

    (
        http_status,
        Json(serde_json::json!({
            "status": status_str,
            "components": {
                "db": { "status": status_str }
            }
        }))
    )
}
