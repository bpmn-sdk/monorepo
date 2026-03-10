//! AI CLI adapters — spawn Claude, Copilot, and Gemini CLIs and stream their output.

use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// ── Adapter trait ─────────────────────────────────────────────────────────────

pub struct Message {
    pub role: String,
    pub content: String,
}

pub struct Adapter {
    pub name: &'static str,
    pub supports_mcp: bool,
    check_cmd: &'static str,
    check_arg: &'static str,
}

impl Adapter {
    pub async fn available(&self) -> bool {
        Command::new(self.check_cmd)
            .arg(self.check_arg)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

pub const CLAUDE: Adapter = Adapter {
    name: "claude",
    supports_mcp: true,
    check_cmd: "claude",
    check_arg: "--version",
};

pub const COPILOT: Adapter = Adapter {
    name: "copilot",
    supports_mcp: true,
    check_cmd: "copilot",
    check_arg: "--version",
};

pub const GEMINI: Adapter = Adapter {
    name: "gemini",
    supports_mcp: false,
    check_cmd: "gemini",
    check_arg: "--version",
};

pub const ALL_ADAPTERS: &[&Adapter] = &[&CLAUDE, &COPILOT, &GEMINI];

// ── Stream helpers ────────────────────────────────────────────────────────────

/// Stream Claude CLI output (NDJSON), extracting text blocks.
pub async fn stream_claude(
    messages: &[Message],
    system_prompt: &str,
    mcp_config_file: Option<&str>,
    mut on_token: impl FnMut(String),
) -> anyhow::Result<()> {
    let parts: Vec<String> = std::iter::once(system_prompt.to_string())
        .chain(std::iter::once(String::new()))
        .chain(messages.iter().map(|m| {
            let role = if m.role == "user" { "Human" } else { "Assistant" };
            format!("{role}: {}", m.content)
        }))
        .chain(std::iter::once("Assistant:".to_string()))
        .collect();
    let full_prompt = parts.join("\n");

    let mut args = vec![
        "-p".to_string(),
        full_prompt,
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];
    if let Some(cfg) = mcp_config_file {
        args.push("--mcp-config".to_string());
        args.push(cfg.to_string());
        args.push("--allowedTools".to_string());
        args.push(
            "mcp__bpmn__get_diagram,mcp__bpmn__add_elements,mcp__bpmn__remove_elements,\
             mcp__bpmn__update_element,mcp__bpmn__set_condition,mcp__bpmn__add_http_call,\
             mcp__bpmn__replace_diagram"
                .to_string(),
        );
        args.push("--strict-mcp-config".to_string());
    }

    eprintln!("[claude] spawning with MCP: {}", mcp_config_file.is_some());

    let mut child = Command::new("claude")
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().expect("stdout piped");
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
            if event["type"] == "assistant" {
                if let Some(blocks) = event["message"]["content"].as_array() {
                    for block in blocks {
                        if block["type"] == "text" {
                            if let Some(text) = block["text"].as_str() {
                                on_token(text.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    let status = child.wait().await?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("claude exited with code {}", status.code().unwrap_or(-1)))
    }
}

/// Stream Copilot CLI output (raw stdout lines).
pub async fn stream_copilot(
    messages: &[Message],
    system_prompt: &str,
    mcp_config_file: Option<&str>,
    mut on_token: impl FnMut(String),
) -> anyhow::Result<()> {
    let last_user = messages.iter().rev().find(|m| m.role == "user");
    let prompt = format!("{system_prompt}\n\nUser: {}", last_user.map(|m| m.content.as_str()).unwrap_or("help"));

    let mut args = vec!["-p".to_string(), prompt, "--yolo".to_string()];
    if let Some(cfg) = mcp_config_file {
        args.push("--additional-mcp-config".to_string());
        args.push(cfg.to_string());
        args.push("--allow-all-tools".to_string());
    }

    eprintln!("[copilot] spawning with MCP: {}", mcp_config_file.is_some());

    let mut child = Command::new("copilot")
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().expect("stdout piped");
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await? {
        on_token(line + "\n");
    }

    let status = child.wait().await?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("copilot exited with code {}", status.code().unwrap_or(-1)))
    }
}

/// Stream Gemini CLI output (raw stdout lines, no MCP).
pub async fn stream_gemini(
    messages: &[Message],
    system_prompt: &str,
    mut on_token: impl FnMut(String),
) -> anyhow::Result<()> {
    let last_user = messages.iter().rev().find(|m| m.role == "user");
    let prompt = format!("{system_prompt}\n\nUser: {}", last_user.map(|m| m.content.as_str()).unwrap_or("help"));

    eprintln!("[gemini] spawning (no MCP support — using system prompt fallback)");

    let mut child = Command::new("gemini")
        .args(["--prompt", &prompt, "--yolo"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().expect("stdout piped");
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await? {
        on_token(line + "\n");
    }

    let status = child.wait().await?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("gemini exited with code {}", status.code().unwrap_or(-1)))
    }
}
