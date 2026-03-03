use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_ai_server(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

/// Spawns the bundled native AI server binary as a background process.
/// Silently skipped if the binary is not present (e.g. during `tauri dev`
/// without a prior Rust release build).
fn spawn_ai_server(app: &tauri::App) {
    let Ok(resource_dir) = app.path().resource_dir() else {
        return;
    };
    let server_path = resource_dir.join("ai-server");
    let mcp_path = resource_dir.join("bpmn-mcp");
    if server_path.exists() {
        let _ = std::process::Command::new(&server_path)
            .env("BPMN_MCP_PATH", &mcp_path)
            .spawn();
    }
}
