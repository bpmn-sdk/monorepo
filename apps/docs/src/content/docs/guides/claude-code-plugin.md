---
title: Claude Code Plugin
description: Install the bpmnkit plugin for Claude Code to get AI-first BPMN development and operations — generate diagrams, scaffold workers, deploy, and resolve incidents from natural language.
---

The bpmnkit Claude Code plugin adds BPMN-aware slash commands, autonomous agents, and
ambient quality hooks directly into Claude Code. Install it once and Claude becomes your
BPMN co-pilot for both building new processes and operating running ones.

## Prerequisites

Install the BPMNKit CLI globally:

```sh
npm install -g @bpmnkit/cli
```

The plugin connects to `casen proxy mcp` for its MCP tools. The proxy starts automatically
on session open — no manual setup needed.

## Installation

### Local (development or team)

```sh
claude --plugin-dir ./plugins-claude/bpmnkit-claude
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    { "path": "./plugins-claude/bpmnkit-claude", "scope": "project" }
  ]
}
```

### Via marketplace

```sh
# Add the BPMNKit marketplace to Claude Code settings, then:
/plugin install bpmnkit
```

## Configuration

When the plugin is enabled, Claude Code prompts for two optional values:

| Config key | Description |
|---|---|
| `camunda_endpoint` | Camunda 8 REST API endpoint (leave blank for local reebe) |
| `camunda_token` | Camunda 8 OAuth2 token (leave blank for local reebe) |

Leave both blank to use the local [reebe engine](/cli/reebe).

---

## Skills

### `/bpmnkit:generate <description>`

Generate a BPMN process from a natural language description.

```
/bpmnkit:generate order fulfillment with payment and inventory check
/bpmnkit:generate employee onboarding process with HR approval
```

Creates a `.bpmn` file in the current directory and shows the process structure.

---

### `/bpmnkit:review [file.bpmn]`

Run static analysis — pattern checks, variable flow, optimizer findings.

```
/bpmnkit:review
/bpmnkit:review order-fulfillment.bpmn
```

Reports findings grouped by severity: errors (block deploy), warnings, info.

---

### `/bpmnkit:deploy [file.bpmn] [--local|--camunda]`

Deploy a process to local reebe or Camunda 8.

```
/bpmnkit:deploy
/bpmnkit:deploy order-fulfillment.bpmn --camunda
```

Confirms the deployment with process ID and version.

---

### `/bpmnkit:worker <job-type>`

Scaffold a TypeScript worker stub for a service task job type.

```
/bpmnkit:worker order-validator
/bpmnkit:worker send-invoice-email
```

Creates `workers/<job-type>.ts` using `@bpmnkit/worker-client`.

---

### `/bpmnkit:test [file.bpmn]`

Run scenario tests and report path coverage.

```
/bpmnkit:test
/bpmnkit:test order-fulfillment.bpmn
```

Shows pass/fail per scenario, uncovered paths, and a coverage percentage.

---

### `/bpmnkit:instances [process-id] [--active|--failed]`

List running process instances.

```
/bpmnkit:instances
/bpmnkit:instances order-process --failed
```

Table view with instance ID, status, start time, and variable summary.

---

### `/bpmnkit:incidents [--process-id X]`

List open incidents with suggested resolution actions.

```
/bpmnkit:incidents
/bpmnkit:incidents --process-id order-process
```

Each row includes the error type and a suggested next action.

---

### `/bpmnkit:ascii <file>`

Show the structure of a BPMN, DMN, or Form file — element list and lint findings.

```
/bpmnkit:ascii order-fulfillment.bpmn
```

---

## Agents

### `process-builder`

Builds a complete BPMN process end-to-end from a description. Invoke directly:

```
Build me an invoice approval process for accounts payable
```

**What it does:**

1. Asks clarifying questions (error paths, user tasks, deploy target)
2. Checks domain patterns (`pattern_list` / `pattern_get`)
3. Generates the BPMN via `bpmn_create`
4. Shows a preview and **waits for your approval**
5. Validates and auto-fixes errors
6. Saves the `.bpmn` file
7. Scaffolds a TypeScript worker for every service task
8. Deploys to the chosen target
9. Reports the process ID, files created, and next steps

---

### `incident-resolver`

Triages and resolves open Camunda incidents. Invoke directly:

```
Investigate and resolve the open incidents
```

**What it does:**

1. Fetches all open incidents (`casen incident list`)
2. Groups by process + error type, sorted by count
3. Investigates root cause per group
4. **Proposes a fix and waits for your approval** before executing
5. Executes approved fixes (retry jobs, resolve incidents, migrate instances)
6. Verifies the count dropped
7. Reports a resolution summary

---

## Ambient Hooks

The plugin installs two background hooks:

| Hook | Trigger | What it does |
|---|---|---|
| SessionStart | Every Claude Code session | Checks `casen` is installed; starts the proxy in background |
| PostToolUse | After any Write or Edit | Silently lints any `.bpmn` file that was written; surfaces findings as a notification |

The PostToolUse hook means every `.bpmn` file you (or Claude) writes is automatically
checked against the BPMNKit pattern advisor — zero extra steps.

---

## MCP Tools

The plugin exposes 10 MCP tools via `casen proxy mcp`:

| Tool | Description |
|---|---|
| `bpmn_create` | Generate BPMN from natural language description |
| `bpmn_read` | Read a BPMN file as compact JSON |
| `bpmn_update` | Update a BPMN file from a natural language instruction |
| `bpmn_validate` | Run pattern advisor and return findings |
| `bpmn_deploy` | Deploy to local reebe or Camunda 8 |
| `bpmn_simulate` | Structural analysis and worker coverage check |
| `bpmn_run_history` | Query recent process executions from the proxy |
| `worker_list` | List built-in and scaffolded workers |
| `worker_scaffold` | Scaffold a TypeScript worker for a job type |
| `pattern_list` | List available domain process patterns |
| `pattern_get` | Get a domain pattern by ID or free-text query |

These tools are available to all skills and agents, and can be called directly by Claude
during any conversation when the plugin is active.
