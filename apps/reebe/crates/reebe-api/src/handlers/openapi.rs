//! OpenAPI specification and Swagger UI endpoints.

use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse, Response};

/// Minimal OpenAPI 3.1 spec for Reebe — covers the core endpoints.
const OPENAPI_SPEC: &str = include_str!("../openapi.json");

/// Serve the OpenAPI JSON spec.
pub async fn openapi_spec() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json")],
        OPENAPI_SPEC,
    )
        .into_response()
}

/// Serve Swagger UI pointing at the OpenAPI spec.
pub async fn swagger_ui() -> Html<String> {
    Html(format!(
        r#"<!DOCTYPE html>
<html>
<head>
  <title>Reebe API — Swagger UI</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = function() {{
  SwaggerUIBundle({{
    url: "/v2/api-docs",
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: "StandaloneLayout",
    validatorUrl: null
  }})
}}
</script>
</body>
</html>"#
    ))
}
