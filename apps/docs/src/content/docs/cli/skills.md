---
title: AIKit Skills
description: Claude Code slash commands for AI-driven process implementation, review, testing, and deployment.
---

AIKit ships four Claude Code slash commands that automate the full process development
lifecycle — from natural language description to deployed, running process.

## Installation

```sh
casen skills install
```

Copies the skill files into `.claude/commands/` in the current project directory.
Once installed, they appear in Claude Code's slash command picker.

```sh
# Reinstall or overwrite existing skills
casen skills install --force
```

The skills require the BPMNKit AIKit MCP server. Make sure `.claude/mcp.json` is present
in your project (created automatically by `casen skills install`).

---

## `/implement`

End-to-end process implementation from a natural language description.

```
/implement an invoice approval process for accounts payable
/implement employee onboarding with Okta provisioning and Jira ticket creation
/implement a supplier contract review workflow with DocuSign e-signature
```

**What it does:**

1. Calls `pattern_list` — checks for a matching domain pattern
2. Calls `bpmn_create` — generates the BPMN process diagram
3. Calls `worker_list` and `worker_scaffold` — wires existing workers or scaffolds new ones
4. Calls `bpmn_validate` — checks for errors and pattern violations
5. Calls `bpmn_simulate` — reports worker coverage
6. Presents a summary and asks where to deploy

**Output:**
```
BPMN file: invoice-approval.bpmn
Pattern used: invoice-approval

Workers:
  ✓ reused:     bpmnkit:llm:1
  + scaffolded: workers/validate-invoice/, workers/trigger-payment/

Validation: 0 errors, 1 warning
Worker coverage: 4/4 service tasks

Deploy to local reebe, deploy to Camunda 8, or skip?
```

See [AI-Driven Implementation](/guides/ai-implement/) for a full walkthrough.

---

## `/review`

Validate an existing BPMN file and get a structured findings report.

```
/review invoice-approval.bpmn
/review path/to/process.bpmn
```

**What it does:**

1. Calls `bpmn_validate` on the file
2. Groups findings by severity: errors, warnings, info
3. Shows element IDs and fix suggestions for each finding
4. Offers to apply auto-fixable issues

**Example output:**

```
Errors (1):
  - [Task_1] Service task has no error boundary event (required for external calls)
    → Add an error boundary event and connect it to an error end event

Warnings (2):
  - [Gateway_1] Gateway has no default flow
  - [Process_1] No timer event on long-running tasks

Auto-fixable: 0
```

---

## `/test`

Analyse a BPMN process: structure, worker coverage, and scenario suggestions.

```
/test invoice-approval.bpmn
```

**What it does:**

1. Calls `bpmn_read` to understand the process structure
2. Calls `bpmn_simulate` to check worker coverage
3. Calls `worker_list` to compare against available workers
4. Suggests test scenarios derived from the diagram structure

**Example output:**

```
Process structure:
  Service tasks: validate-invoice, check-duplicate, notify-approver, trigger-payment
  Gateways: approval decision (exclusive), amount threshold (exclusive)
  Events: start, timer (SLA 48h), end

Worker coverage: 4/4
  ✓ validate-invoice → workers/validate-invoice/
  ✓ check-duplicate  → bpmnkit:llm:1
  ✓ notify-approver  → bpmnkit:email:send:1
  ✓ trigger-payment  → workers/trigger-payment/

Suggested scenarios:
  Happy path: invoice submitted → validated → approved → payment triggered
  Edge: invoice rejected at approval → rejection notification
  Edge: SLA timeout fires before approval
  Edge: duplicate invoice detected
```

---

## `/deploy`

Deploy a BPMN process to local reebe or Camunda 8.

```
/deploy invoice-approval.bpmn
```

**What it does:**

1. Calls `bpmn_validate` — shows errors, optionally blocks deployment
2. Asks: deploy to local reebe or Camunda 8?
3. Calls `bpmn_deploy` with the chosen target
4. Reminds you to start workers if any are scaffolded

**Targets:**

- **Local reebe** — deploys via `ZEEBE_ADDRESS` (default `http://localhost:26500`).
  Start reebe first: `casen reebe`
- **Camunda 8** — deploys using the active `casen` profile.
  Set one up: `casen profile add`

---

## MCP server requirement

The skills use the BPMNKit AIKit MCP server (`bpmn-aikit`) to call BPMNKit tools.
The project-level config at `.claude/mcp.json` registers it automatically:

```json
{
  "mcpServers": {
    "bpmnkit-aikit": {
      "type": "stdio",
      "command": "node",
      "args": ["apps/proxy/dist/aikit-mcp.js"],
      "env": {
        "BPMNKIT_PROXY_URL": "http://localhost:3033"
      }
    }
  }
}
```

The proxy must be running for `bpmn_create` and `bpmn_update` (which use the AI bridge).
Start it with `casen proxy`.

Other tools (`bpmn_validate`, `bpmn_simulate`, `bpmn_read`, `worker_scaffold`) work offline.
