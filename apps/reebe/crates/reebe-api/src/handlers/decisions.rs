use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};

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

pub async fn search_decision_definitions() -> impl IntoResponse {
    not_implemented()
}

pub async fn get_decision_definition() -> impl IntoResponse {
    not_implemented()
}

pub async fn search_decision_instances() -> impl IntoResponse {
    not_implemented()
}

pub async fn search_decision_requirements() -> impl IntoResponse {
    not_implemented()
}

/// Request body for POST /v2/decisions/evaluation
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateDecisionRequest {
    /// Decision definition ID (e.g. "invoice-classification")
    pub decision_definition_id: Option<String>,
    /// Decision definition key (numeric, alternative to ID)
    pub decision_definition_key: Option<i64>,
    /// Input variables for the decision evaluation
    pub variables: Option<serde_json::Value>,
}

pub async fn evaluate_decision(
    State(state): State<ApiState>,
    Json(req): Json<EvaluateDecisionRequest>,
) -> ApiResult<impl IntoResponse> {
    use sqlx::Row;

    let variables = req.variables.unwrap_or(serde_json::Value::Object(Default::default()));

    // Resolve which decision definition to use
    let dmn_xml: String;
    let found_decision_id: String;

    if let Some(key) = req.decision_definition_key {
        // Look up by primary key
        let row = sqlx::query(
            "SELECT dmn_xml, decision_id FROM decision_definitions WHERE key = $1",
        )
        .bind(key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound {
            resource: "decision_definition".to_string(),
            key: key.to_string(),
        })?;

        dmn_xml = row.get("dmn_xml");
        found_decision_id = row.get("decision_id");
    } else if let Some(ref decision_id) = req.decision_definition_id {
        // Look up by decision_id, latest version
        let row = sqlx::query(
            r#"SELECT dmn_xml, decision_id
               FROM decision_definitions
               WHERE decision_id = $1
               ORDER BY version DESC
               LIMIT 1"#,
        )
        .bind(decision_id.as_str())
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound {
            resource: "decision_definition".to_string(),
            key: decision_id.clone(),
        })?;

        dmn_xml = row.get("dmn_xml");
        found_decision_id = row.get("decision_id");
    } else {
        return Err(ApiError::InvalidRequest(
            "Either decisionDefinitionId or decisionDefinitionKey must be provided".to_string(),
        ));
    }

    // Parse the DMN XML
    let drg = reebe_dmn::parse_dmn(&dmn_xml)
        .map_err(|e| ApiError::InvalidRequest(format!("DMN parse error: {}", e)))?;

    // Evaluate the decision
    let result = reebe_dmn::evaluate_decision(&drg, &found_decision_id, &variables)
        .map_err(|e| ApiError::InvalidRequest(format!("DMN evaluation error: {}", e)))?;

    Ok(Json(json!({
        "decisionDefinitionId": found_decision_id,
        "result": result,
    })))
}
