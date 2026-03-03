use bpmn_ai_server::ai_server;
use bpmn_ai_server::bridge::CoreBridge;
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("AI_SERVER_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3033);

    // Resolve the bpmn-mcp binary path.
    // Prefer BPMN_MCP_PATH env var (set by Tauri from resource dir).
    // Fall back to a sibling binary next to this executable.
    let mcp_bin: PathBuf = if let Ok(p) = std::env::var("BPMN_MCP_PATH") {
        PathBuf::from(p)
    } else {
        std::env::current_exe()
            .unwrap_or_else(|_| PathBuf::from("bpmn-mcp"))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("bpmn-mcp")
    };

    eprintln!("[ai-server] mcp_bin: {}", mcp_bin.display());

    let bridge = CoreBridge::new();
    let state = ai_server::AppState { bridge, mcp_bin };
    let app = ai_server::router(state);

    let addr = format!("0.0.0.0:{port}");
    eprintln!("BPMN SDK AI Server running at http://localhost:{port}");
    eprintln!("Press Ctrl+C to stop");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");
    axum::serve(listener, app).await.expect("server error");
}
