# BPMNKit Claude Code Plugin

AI-first BPMN development and operations for Claude Code. Generate diagrams, scaffold workers, deploy processes, and resolve incidents — all from natural language.

## Prerequisites

```sh
npm install -g @bpmnkit/cli
```

## Installation

**From marketplace:**

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

**Local (development or team):**

```sh
claude --plugin-dir ./plugins-claude/bpmnkit-claude
```

## Configuration

On first enable, Claude Code prompts for two optional values:

| Key | Description |
|-----|-------------|
| `camunda_endpoint` | Camunda 8 REST API endpoint — leave blank for local reebe |
| `camunda_token` | Camunda 8 OAuth2 token — leave blank for local reebe |

## Skills

| Skill | What it does |
|-------|--------------|
| `/bpmnkit:generate <description>` | Natural language → `.bpmn` file |
| `/bpmnkit:review [file]` | Static analysis grouped by severity |
| `/bpmnkit:deploy [file] [--local\|--camunda]` | Deploy to reebe or Camunda 8 |
| `/bpmnkit:worker <job-type>` | Scaffold TypeScript worker stub |
| `/bpmnkit:test [file]` | Run scenario tests, show path coverage |
| `/bpmnkit:instances [id] [--active\|--failed]` | List running process instances |
| `/bpmnkit:incidents [--process-id X]` | List open incidents with actions |
| `/bpmnkit:ascii <file>` | Show BPMN/DMN/Form structure and elements |

## Agents

**`process-builder`** — describe a process, get a deployed process + worker stubs:

> "Build me an invoice approval process for accounts payable"

Steps: clarify → check patterns → generate → **preview (approval gate)** → validate → save → scaffold workers → deploy → summary.

**`incident-resolver`** — triage and resolve open incidents:

> "Investigate and resolve the open incidents"

Steps: fetch → group by type → investigate root cause → **propose fix (approval gate)** → execute → verify → summary.

## Hooks

- **SessionStart** — checks `casen` is installed, auto-starts the proxy in background
- **PostToolUse** — silently lints any `.bpmn` file written during the session

## MCP Tools (via `casen proxy mcp`)

`bpmn_create` · `bpmn_read` · `bpmn_update` · `bpmn_validate` · `bpmn_deploy` · `bpmn_simulate` · `bpmn_run_history` · `worker_list` · `worker_scaffold` · `pattern_list` · `pattern_get`

## Structure

```
.claude-plugin/
  plugin.json       manifest
  marketplace.json  marketplace entry
skills/
  generate/         /bpmnkit:generate
  review/           /bpmnkit:review
  deploy/           /bpmnkit:deploy
  worker/           /bpmnkit:worker
  test/             /bpmnkit:test
  instances/        /bpmnkit:instances
  incidents/        /bpmnkit:incidents
  ascii/            /bpmnkit:ascii
agents/
  process-builder.md
  incident-resolver.md
hooks/
  hooks.json        SessionStart + PostToolUse
.mcp.json           MCP server config → casen proxy mcp
```

## Full documentation

[bpmnkit.com/guides/claude-code-plugin](https://bpmnkit.com/guides/claude-code-plugin)
