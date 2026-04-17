# BPMNKit Claude Plugin Design

**Date:** 2026-04-17  
**Status:** Approved

## Overview

A Claude Code plugin (`/plugin install bpmnkit`) that makes Claude AI-first for BPMN workflows. Targets both developers building new processes and operators managing running ones. Connects to the existing `casen proxy` MCP server — no duplicated logic.

**Prerequisite:** `npm install -g @bpmnkit/cli`

---

## Location

```
plugins-claude/bpmnkit-claude/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── generate/SKILL.md
│   ├── review/SKILL.md
│   ├── deploy/SKILL.md
│   ├── worker/SKILL.md
│   ├── test/SKILL.md
│   ├── instances/SKILL.md
│   ├── incidents/SKILL.md
│   └── ascii/SKILL.md
├── agents/
│   ├── process-builder.md
│   └── incident-resolver.md
├── hooks/
│   └── hooks.json
└── .mcp.json
```

---

## Plugin Manifest (`plugin.json`)

```json
{
  "name": "bpmnkit",
  "version": "0.1.0",
  "description": "AI-first BPMN development and operations for Claude Code",
  "skills": "./skills/",
  "agents": "./agents/",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json",
  "userConfig": {
    "camunda_endpoint": {
      "description": "Camunda 8 REST API endpoint (optional, defaults to local reebe)",
      "sensitive": false
    },
    "camunda_token": {
      "description": "Camunda 8 OAuth2 token (optional)",
      "sensitive": true
    }
  }
}
```

---

## MCP Config (`.mcp.json`)

Stdio transport pointing to the existing proxy MCP server:

```json
{
  "mcpServers": {
    "bpmnkit": {
      "command": "casen",
      "args": ["proxy", "mcp"],
      "env": {
        "BPMNKIT_ENDPOINT": "${user_config.camunda_endpoint}",
        "BPMNKIT_TOKEN": "${user_config.camunda_token}"
      }
    }
  }
}
```

Exposes existing tools: `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`.

---

## Hooks (`hooks/hooks.json`)

### SessionStart — prerequisites + proxy auto-start

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "which casen > /dev/null 2>&1 || echo 'BPMNKit: casen CLI not found. Install with: npm install -g @bpmnkit/cli'"
          },
          {
            "type": "command",
            "command": "casen proxy start --background 2>/dev/null || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$CLAUDE_TOOL_OUTPUT\" | grep -q '\\.bpmn' && casen lint \"$(echo \"$CLAUDE_TOOL_OUTPUT\" | grep -o '[^ ]*\\.bpmn')\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### PostToolUse — auto-validate on BPMN writes

Fires silently when any `Write` or `Edit` touches a `.bpmn` file. Runs `casen lint <file>` and surfaces findings as a notification. No output if clean.

---

## Skills

### `/bpmnkit:generate <description>`

Natural language → BPMN file.

1. Calls MCP `bpmn_create` with the description
2. Saves output as `<slug>.bpmn` in current directory
3. Shows ASCII preview via MCP or `casen bpmn render`

---

### `/bpmnkit:review [file]`

Static analysis on a BPMN file.

1. Reads file (defaults to only `.bpmn` in cwd if unambiguous)
2. Calls MCP `bpmn_validate`
3. Reports findings grouped by severity: error → warning → info
4. Each finding includes element ID, description, and fix hint

---

### `/bpmnkit:deploy [file] [--local|--camunda]`

Deploy to local reebe or Camunda 8.

1. Calls MCP `bpmn_deploy` with target flag
2. Confirms deployment: process ID, version, endpoint
3. Prints `casen process-definition list` excerpt to verify

---

### `/bpmnkit:worker <job-type>`

Scaffold a TypeScript worker for a service task.

1. Runs `casen worker <job-type>` or generates via template
2. Uses `@bpmnkit/worker-client` for zero-SDK runtime
3. Saves to `workers/<job-type>.ts`
4. Shows the generated file with next-step instructions

---

### `/bpmnkit:test [file]`

Run scenario tests.

1. Runs `casen test <file>` (or all `.bpmn` files if no arg)
2. Reports per-scenario: pass/fail, path coverage, variable assertions
3. Shows uncovered paths as suggestions

---

### `/bpmnkit:instances [process-id] [--active|--failed]`

List running process instances.

1. Runs `casen process-instance list` with filters
2. Table: instance ID, process, status, start time, variables summary
3. `--failed` narrows to error state only

---

### `/bpmnkit:incidents [--process-id X]`

List open incidents.

1. Runs `casen incident list` with optional filter
2. Table: incident ID, process, element, error type, timestamp
3. Each row includes a one-line suggested action

---

### `/bpmnkit:ascii <file>`

Render a BPMN diagram as Unicode art.

1. Runs `casen bpmn render <file>` (uses `@bpmnkit/ascii` internally)
2. Outputs box-drawing diagram to terminal
3. Works for BPMN, DMN, and Forms

---

## Agents

### `process-builder`

**Trigger:** User describes a process to build (e.g. "build me an order fulfillment process")  
**Model:** sonnet  
**MaxTurns:** 30

**Flow:**
1. Ask clarifying questions: lanes, error paths, which tasks need workers, target (local/Camunda)
2. Call `bpmn_create` → generate process XML
3. Show ASCII preview, wait for user approval
4. Call `bpmn_validate` → fix any findings automatically
5. For each service task: scaffold worker file via `casen worker <type>`
6. Call `bpmn_deploy` → deploy to chosen target
7. Report: process ID, worker files created, deployment URL, suggested next steps

**Allowed tools:** MCP bpmnkit tools, Read, Write, Bash (casen commands only)

---

### `incident-resolver`

**Trigger:** User asks to resolve or investigate incidents  
**Model:** sonnet  
**MaxTurns:** 30

**Flow:**
1. `casen incident list` → fetch all open incidents
2. Group by process + error type, sort by count descending
3. For each group: `casen process-instance get <id>` → inspect variables + element state
4. AI analysis: identify root cause, affected elements, blast radius
5. Propose fix (expression update, job retry, instance cancel/migrate)
6. User approves → execute via `casen incident resolve` / `casen job complete` / `casen job fail`
7. Verify resolution via `casen incident list` — confirm count reduced
8. Summary report: resolved count, skipped, recommended follow-ups

**Allowed tools:** Bash (casen commands only), Read (BPMN files for context)

---

## Success Criteria

- `npm install -g @bpmnkit/cli` + `/plugin install bpmnkit` = fully working
- Proxy starts automatically on session open
- `.bpmn` writes trigger silent lint; findings appear as notifications
- `process-builder` agent produces a deployable process + worker stubs from a one-line description
- `incident-resolver` agent triages and resolves incidents without manual `casen` invocations
- All 8 skills work offline (local reebe) and against Camunda 8 with token config
