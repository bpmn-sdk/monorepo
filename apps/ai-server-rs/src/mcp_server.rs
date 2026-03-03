//! JSON-RPC 2.0 stdio MCP server loop.

use std::io::{BufRead, Write};
use serde_json::{Value, json};
use crate::bridge::CoreBridge;
use crate::mcp_tools;

pub fn run(bridge: &CoreBridge, output_path: Option<&str>) {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut out = std::io::BufWriter::new(stdout.lock());

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // Notifications have no id — ignore (no response needed)
        if req.get("id").is_none() {
            continue;
        }

        let id = req["id"].clone();
        let method = req["method"].as_str().unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(json!({}));

        let (result, error): (Option<Value>, Option<Value>) = match method {
            "initialize" => (
                Some(json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "bpmn-mcp", "version": "1.0.0" }
                })),
                None,
            ),

            "tools/list" => (Some(mcp_tools::tool_list()), None),

            "tools/call" => {
                let name = params["name"].as_str().unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                let result = mcp_tools::call_tool(bridge, name, &args, output_path);
                (Some(result), None)
            }

            "ping" => (Some(json!({})), None),

            _ => (None, Some(json!({ "code": -32601, "message": "Method not found" }))),
        };

        let response = if let Some(err) = error {
            json!({ "jsonrpc": "2.0", "id": id, "error": err })
        } else {
            json!({ "jsonrpc": "2.0", "id": id, "result": result.unwrap_or(json!(null)) })
        };

        let _ = writeln!(out, "{}", serde_json::to_string(&response).unwrap_or_default());
        let _ = out.flush();
    }
}
