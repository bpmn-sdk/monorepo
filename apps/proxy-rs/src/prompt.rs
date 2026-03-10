//! System prompt builders (ported from prompt.ts).

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct FindingInfo {
    pub category: String,
    pub severity: String,
    pub message: String,
    pub suggestion: String,
    #[serde(rename = "elementIds")]
    pub element_ids: Vec<String>,
}

const COMPACT_FORMAT: &str = r#"CompactDiagram JSON format:
```json
{
  "id": "Definitions_1",
  "processes": [{
    "id": "Process_1", "name": "My Process",
    "elements": [
      { "id": "start", "type": "startEvent", "name": "Start" },
      { "id": "task1", "type": "serviceTask", "name": "Do Work", "jobType": "my-worker" },
      { "id": "end", "type": "endEvent", "name": "End" }
    ],
    "flows": [{ "id": "f1", "from": "start", "to": "task1" }, { "id": "f2", "from": "task1", "to": "end" }]
  }]
}
```
Element types — Events: startEvent, endEvent, intermediateThrowEvent, intermediateCatchEvent (add eventType: timer|message|signal|error), boundaryEvent (add attachedTo + eventType)
Tasks: serviceTask, userTask (add formId), businessRuleTask (add decisionId+resultVariable), callActivity (add calledProcess), scriptTask, sendTask, manualTask
Gateways: exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway  |  Containers: subProcess, adHocSubProcess
HTTP REST calls: always use jobType: "io.camunda:http-json:1" with taskHeaders {url, method, headers?, body?} and resultVariable."#;

pub fn build_mcp_system_prompt() -> String {
    vec![
        "You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.",
        "Use the available bpmn MCP tools to read and modify the diagram.",
        "Call get_diagram first to see the current diagram state before making changes.",
        "",
        "HTTP/REST RULE: Any time the user asks for an HTTP request, API call, webhook, or external service",
        "integration — you MUST call add_http_call. Never use add_elements for this.",
        "add_http_call sets jobType: io.camunda:http-json:1 and the correct taskHeaders automatically.",
        "Use your knowledge of the target API to supply the real endpoint URL.",
    ]
    .join("\n")
}

pub fn build_mcp_improve_prompt(findings: &[FindingInfo]) -> String {
    let mut lines = vec![
        "You are a BPMN 2.0 process improvement expert.".to_string(),
        "Use the available bpmn tools to analyze and improve the current diagram.".to_string(),
        "Start by calling get_diagram to see the current state, then apply all fixes.".to_string(),
        String::new(),
    ];

    if findings.is_empty() {
        lines.push("No structural issues detected. Apply general best practices:".to_string());
        lines.push("- Group 3+ consecutive related tasks (no branching) into a subProcess.".to_string());
        lines.push("- Remove redundant gateways or unnecessary elements.".to_string());
    } else {
        lines.push("Fix ALL of these detected issues:".to_string());
        for f in findings {
            let els = if f.element_ids.is_empty() {
                String::new()
            } else {
                format!(" [elements: {}]", f.element_ids.join(", "))
            };
            lines.push(format!("- [{}] {}{}", f.category, f.message, els));
            lines.push(format!("  → {}", f.suggestion));
        }
    }

    lines.push(String::new());
    lines.push("Also normalize element names to verb-noun title case (e.g. \"Validate Order\").".to_string());
    lines.join("\n")
}

pub fn build_system_prompt(context: Option<&serde_json::Value>) -> String {
    let mut lines = vec![
        "You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.".to_string(),
        String::new(),
        COMPACT_FORMAT.to_string(),
        String::new(),
        "Return exactly one JSON code block containing the complete updated CompactDiagram. Explain your changes briefly.".to_string(),
    ];

    if let Some(ctx) = context {
        lines.push(String::new());
        lines.push("Current diagram:".to_string());
        lines.push("```json".to_string());
        lines.push(serde_json::to_string_pretty(ctx).unwrap_or_default());
        lines.push("```".to_string());
    }

    lines.join("\n")
}
