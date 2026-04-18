# BPMNKit Claude Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin (`/plugin install bpmnkit`) with 8 skills, 2 agents, and 2 hooks that makes Claude AI-first for BPMN development and operations.

**Architecture:** The plugin connects to the existing `aikit-mcp.js` stdio MCP server (in `@bpmnkit/proxy`) via a new `casen proxy mcp` subcommand, so all BPMN logic stays in the proxy. A `SessionStart` hook auto-starts the proxy HTTP server and checks for `casen`. A `PostToolUse` hook auto-lints `.bpmn` file writes.

**Tech Stack:** Claude Code plugin format, Markdown skill/agent files, JSON config, TypeScript (proxy.ts CLI addition), Node.js

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `plugins-claude/bpmnkit-claude/.claude-plugin/plugin.json` | Plugin manifest |
| `plugins-claude/bpmnkit-claude/.mcp.json` | MCP server config pointing to `casen proxy mcp` |
| `plugins-claude/bpmnkit-claude/hooks/hooks.json` | SessionStart + PostToolUse hooks |
| `plugins-claude/bpmnkit-claude/skills/generate/SKILL.md` | Natural language → BPMN file |
| `plugins-claude/bpmnkit-claude/skills/review/SKILL.md` | Static analysis |
| `plugins-claude/bpmnkit-claude/skills/deploy/SKILL.md` | Deploy to reebe or Camunda |
| `plugins-claude/bpmnkit-claude/skills/worker/SKILL.md` | Scaffold TypeScript worker |
| `plugins-claude/bpmnkit-claude/skills/test/SKILL.md` | Run scenario tests |
| `plugins-claude/bpmnkit-claude/skills/instances/SKILL.md` | List process instances |
| `plugins-claude/bpmnkit-claude/skills/incidents/SKILL.md` | List open incidents |
| `plugins-claude/bpmnkit-claude/skills/ascii/SKILL.md` | Render BPMN as ASCII art |
| `plugins-claude/bpmnkit-claude/agents/process-builder.md` | End-to-end process builder agent |
| `plugins-claude/bpmnkit-claude/agents/incident-resolver.md` | Incident triage and resolution agent |

### Modified files
| File | Change |
|------|--------|
| `apps/proxy/package.json` | Add `"./dist/aikit-mcp.js"` to exports map |
| `apps/cli/src/commands/proxy.ts` | Add `mcp` subcommand that spawns aikit-mcp.js |

---

## Task 1: Add `casen proxy mcp` command

This exposes the existing `aikit-mcp.js` stdio server via a stable CLI entry point that the plugin's MCP config can reference.

**Files:**
- Modify: `apps/proxy/package.json` (exports)
- Modify: `apps/cli/src/commands/proxy.ts`

- [ ] **Step 1: Add aikit-mcp.js to proxy package exports**

In `apps/proxy/package.json`, change the exports block from:
```json
"exports": {
    ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
    }
},
```
to:
```json
"exports": {
    ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
    },
    "./dist/aikit-mcp.js": "./dist/aikit-mcp.js"
},
```

- [ ] **Step 2: Add `mcp` command to proxy.ts**

Replace the full contents of `apps/cli/src/commands/proxy.ts` with:

```typescript
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { startServer } from "@bpmnkit/proxy"
import type { Command, CommandGroup } from "../types.js"

const startCmd: Command = {
	name: "start",
	description: "Start the BPMN Kit proxy server (AI bridge + Camunda API proxy)",
	flags: [
		{
			name: "port",
			description: "Port to listen on",
			type: "number",
			default: 3033,
		},
	],
	examples: [
		{ description: "Start on default port (3033)", command: "casen proxy start" },
		{ description: "Start on a custom port", command: "casen proxy start --port 4000" },
	],
	async run(ctx) {
		const port = (ctx.flags.port as number | undefined) ?? 3033

		ctx.output.info(`Starting BPMN Kit proxy server on port ${port}...`)

		startServer(port)

		await new Promise<void>((resolve) => {
			process.once("SIGINT", resolve)
			process.once("SIGTERM", resolve)
		})
	},
}

const mcpCmd: Command = {
	name: "mcp",
	description: "Start the BPMNKit AIKit MCP server (stdio transport for Claude Code)",
	examples: [
		{
			description: "Start MCP server (used by Claude Code plugin)",
			command: "casen proxy mcp",
		},
	],
	async run(_ctx) {
		const aitKitMcpUrl = import.meta.resolve("@bpmnkit/proxy/dist/aikit-mcp.js")
		const aitKitMcpPath = fileURLToPath(aitKitMcpUrl)

		await new Promise<void>((resolve, reject) => {
			const child = spawn(process.execPath, [aitKitMcpPath], {
				stdio: "inherit",
				env: process.env,
			})

			child.on("error", reject)
			child.on("close", (code) => {
				if (code === 0 || code === null) resolve()
				else reject(new Error(`aikit-mcp exited with code ${code}`))
			})
		})
	},
}

export const proxyGroup: CommandGroup = {
	name: "proxy",
	description: "Start the local AI bridge and Camunda API proxy server",
	commands: [startCmd, mcpCmd],
}
```

- [ ] **Step 3: Build and verify command appears**

```bash
pnpm turbo build --filter=@bpmnkit/cli
```

Expected: build completes with zero errors.

```bash
./apps/cli/dist/index.js proxy --help
```

Expected output includes:
```
Commands:
  start   Start the BPMN Kit proxy server...
  mcp     Start the BPMNKit AIKit MCP server...
```

- [ ] **Step 4: Typecheck**

```bash
pnpm turbo typecheck --filter=@bpmnkit/cli
```

Expected: zero type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/proxy/package.json apps/cli/src/commands/proxy.ts
git commit -m "feat(cli): add casen proxy mcp command for Claude Code plugin integration"
```

---

## Task 2: Scaffold plugin skeleton

Create the directory structure and the two JSON config files.

**Files:**
- Create: `plugins-claude/bpmnkit-claude/.claude-plugin/plugin.json`
- Create: `plugins-claude/bpmnkit-claude/.mcp.json`

- [ ] **Step 1: Create directories**

```bash
mkdir -p plugins-claude/bpmnkit-claude/.claude-plugin
mkdir -p plugins-claude/bpmnkit-claude/skills/generate
mkdir -p plugins-claude/bpmnkit-claude/skills/review
mkdir -p plugins-claude/bpmnkit-claude/skills/deploy
mkdir -p plugins-claude/bpmnkit-claude/skills/worker
mkdir -p plugins-claude/bpmnkit-claude/skills/test
mkdir -p plugins-claude/bpmnkit-claude/skills/instances
mkdir -p plugins-claude/bpmnkit-claude/skills/incidents
mkdir -p plugins-claude/bpmnkit-claude/skills/ascii
mkdir -p plugins-claude/bpmnkit-claude/agents
mkdir -p plugins-claude/bpmnkit-claude/hooks
```

- [ ] **Step 2: Write plugin.json**

Create `plugins-claude/bpmnkit-claude/.claude-plugin/plugin.json`:

```json
{
  "name": "bpmnkit",
  "version": "0.1.0",
  "description": "AI-first BPMN development and operations for Claude Code. Requires: npm install -g @bpmnkit/cli",
  "author": {
    "name": "BPMNKit",
    "url": "https://bpmnkit.com"
  },
  "homepage": "https://bpmnkit.com",
  "repository": "https://github.com/bpmnkit/monorepo",
  "license": "MIT",
  "keywords": ["bpmn", "camunda", "workflow", "process-automation"],
  "skills": "./skills/",
  "agents": "./agents/",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json",
  "userConfig": {
    "camunda_endpoint": {
      "description": "Camunda 8 REST API endpoint (optional, leave blank for local reebe)",
      "sensitive": false
    },
    "camunda_token": {
      "description": "Camunda 8 OAuth2 token (optional, leave blank for local reebe)",
      "sensitive": true
    }
  }
}
```

- [ ] **Step 3: Write .mcp.json**

Create `plugins-claude/bpmnkit-claude/.mcp.json`:

```json
{
  "mcpServers": {
    "bpmnkit": {
      "type": "stdio",
      "command": "casen",
      "args": ["proxy", "mcp"],
      "env": {
        "BPMNKIT_PROXY_URL": "http://localhost:3033",
        "BPMNKIT_ENDPOINT": "${user_config.camunda_endpoint}",
        "BPMNKIT_TOKEN": "${user_config.camunda_token}"
      }
    }
  }
}
```

- [ ] **Step 4: Commit skeleton**

```bash
git add plugins-claude/
git commit -m "feat(plugin): scaffold bpmnkit Claude Code plugin skeleton"
```

---

## Task 3: Write hooks.json

Two hooks: auto-start proxy on session open; auto-lint `.bpmn` files on write.

**Files:**
- Create: `plugins-claude/bpmnkit-claude/hooks/hooks.json`

- [ ] **Step 1: Write hooks.json**

Create `plugins-claude/bpmnkit-claude/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "which casen > /dev/null 2>&1 || echo 'BPMNKit plugin: casen CLI not found. Install with: npm install -g @bpmnkit/cli'"
          },
          {
            "type": "command",
            "command": "pgrep -f 'casen proxy start' > /dev/null 2>&1 || (nohup casen proxy start > /tmp/bpmnkit-proxy.log 2>&1 &)"
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
            "command": "FILE=$(node -e \"try{const i=JSON.parse(process.env.CLAUDE_TOOL_INPUT||'{}');process.stdout.write(i.file_path||i.path||'')}catch{}\"); [[ \"$FILE\" == *.bpmn ]] && casen lint \"$FILE\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins-claude/bpmnkit-claude/hooks/hooks.json
git commit -m "feat(plugin): add SessionStart and PostToolUse hooks"
```

---

## Task 4: Write developer skills (generate, review, deploy, worker)

**Files:**
- Create: `plugins-claude/bpmnkit-claude/skills/generate/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/review/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/deploy/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/worker/SKILL.md`

- [ ] **Step 1: Write generate/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/generate/SKILL.md`:

```markdown
---
name: generate
description: Generate a BPMN process diagram from a natural language description. Creates a .bpmn file and shows an ASCII preview. Usage: /bpmnkit:generate <description>
---

Generate a BPMN process from this description: $ARGUMENTS

Steps:
1. Call the `bpmn_create` MCP tool with the description as input. It returns BPMN XML.
2. Derive a filename: lowercase the first 4 significant words of the description, join with hyphens, append `.bpmn`. Example: "order fulfillment process" → `order-fulfillment-process.bpmn`.
3. Write the XML to `<filename>.bpmn` in the current directory using the Write tool.
4. Run `casen bpmn render <filename>.bpmn` via Bash and show the ASCII output so the user can see the diagram structure.
5. Print a summary: filename, number of elements, list of service task job types (if any).

If `bpmn_create` is not available (MCP not connected), tell the user to run `casen proxy start` first, then retry.
```

- [ ] **Step 2: Write review/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/review/SKILL.md`:

```markdown
---
name: review
description: Run static analysis on a BPMN file — pattern checks, variable flow, optimizer findings. Shows findings grouped by severity. Usage: /bpmnkit:review [file.bpmn]
---

Review the BPMN file for issues: $ARGUMENTS

Steps:
1. Determine the target file:
   - If $ARGUMENTS contains a filename ending in `.bpmn`, use that.
   - Otherwise, run `ls *.bpmn 2>/dev/null` in the current directory. If exactly one `.bpmn` file exists, use it. If multiple exist, list them and ask the user to specify.
2. Read the file with the Read tool.
3. Call the `bpmn_validate` MCP tool with the XML content.
4. Format and display findings grouped by severity:

   **Errors** (must fix before deploy)
   - [element-id] Description. Fix: hint.

   **Warnings** (should fix)
   - [element-id] Description. Fix: hint.

   **Info** (consider)
   - [element-id] Description.

5. If zero findings: print "No issues found. Process looks good."
6. Print a summary line: "X errors, Y warnings, Z info"
```

- [ ] **Step 3: Write deploy/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/deploy/SKILL.md`:

```markdown
---
name: deploy
description: Deploy a BPMN process to local reebe or Camunda 8. Usage: /bpmnkit:deploy [file.bpmn] [--local|--camunda]
---

Deploy the BPMN process: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS:
   - Extract filename (ends in `.bpmn`). If not provided, find the single `.bpmn` file in cwd (or ask).
   - Extract target flag: `--local` or `--camunda`. Default: `--local`.
2. Read the file with the Read tool.
3. Call `bpmn_deploy` MCP tool with:
   - `xml`: file contents
   - `target`: `"local"` or `"camunda"` based on the flag
4. Show the deployment result:
   ```
   Deployed: <process-id>  version: <N>  target: <local|camunda>
   ```
5. Verify by running `casen process-definition list --output json` via Bash and showing the matching row.
6. If deploy fails with a connection error, suggest: "Start the proxy with `casen proxy start`, or for Camunda check your endpoint config."
```

- [ ] **Step 4: Write worker/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/worker/SKILL.md`:

```markdown
---
name: worker
description: Scaffold a TypeScript worker file for a BPMN service task job type. Usage: /bpmnkit:worker <job-type>
---

Scaffold a worker for job type: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS to get the job type string (e.g. `order-validator`, `send-email`).
2. Call `worker_scaffold` MCP tool with `jobType: "<job-type>"`. It returns a TypeScript worker file using `@bpmnkit/worker-client`.
3. Create a `workers/` directory if it doesn't exist (check with Bash: `ls workers/ 2>/dev/null || mkdir workers`).
4. Write the result to `workers/<job-type>.ts` using the Write tool.
5. Show the generated file contents.
6. Print next steps:
   ```
   Next steps:
   1. Edit workers/<job-type>.ts — implement the job logic
   2. Run the worker: node workers/<job-type>.ts
   3. Or start all workers: casen worker start
   ```

If `worker_scaffold` is unavailable, generate this template directly:

```typescript
import { activateJobs, completeJob, failJob } from "@bpmnkit/worker-client"

const JOB_TYPE = "<job-type>"

async function run() {
  for await (const job of activateJobs({ type: JOB_TYPE })) {
    try {
      const { /* destructure variables */ } = job.variables

      // TODO: implement job logic

      await completeJob(job, { /* output variables */ })
    } catch (err) {
      await failJob(job, { errorMessage: String(err) })
    }
  }
}

run().catch(console.error)
```
```

- [ ] **Step 5: Commit developer skills**

```bash
git add plugins-claude/bpmnkit-claude/skills/generate \
        plugins-claude/bpmnkit-claude/skills/review \
        plugins-claude/bpmnkit-claude/skills/deploy \
        plugins-claude/bpmnkit-claude/skills/worker
git commit -m "feat(plugin): add developer skills — generate, review, deploy, worker"
```

---

## Task 5: Write operator skills (test, instances, incidents, ascii)

**Files:**
- Create: `plugins-claude/bpmnkit-claude/skills/test/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/instances/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/incidents/SKILL.md`
- Create: `plugins-claude/bpmnkit-claude/skills/ascii/SKILL.md`

- [ ] **Step 1: Write test/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/test/SKILL.md`:

```markdown
---
name: test
description: Run scenario tests on a BPMN process file and report path coverage. Usage: /bpmnkit:test [file.bpmn]
---

Run scenario tests: $ARGUMENTS

Steps:
1. Determine target file: extract `.bpmn` filename from $ARGUMENTS, or find the single `.bpmn` in cwd, or ask.
2. Run via Bash: `casen test <file.bpmn>`
3. Parse and display results:

   **Scenario Results**
   | Scenario | Result | Path |
   |----------|--------|------|
   | happy-path | ✓ PASS | start → validate → fulfill → end |
   | error-path | ✗ FAIL | start → validate → [missing handler] |

4. Show uncovered paths if any:
   ```
   Uncovered paths:
   - Gateway "check-stock" → branch "out-of-stock" has no test scenario
   ```
5. Summary: "X/Y scenarios passed. Path coverage: Z%"
```

- [ ] **Step 2: Write instances/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/instances/SKILL.md`:

```markdown
---
name: instances
description: List running process instances with optional filters. Usage: /bpmnkit:instances [process-id] [--active|--failed]
---

List process instances: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS:
   - Extract process ID if present (non-flag argument)
   - Extract `--active` or `--failed` flag if present
2. Build the casen command:
   - Base: `casen process-instance list --output json`
   - If process ID given: append `--process-definition-key <id>`
   - If `--failed`: append `--state ERROR`
   - If `--active`: append `--state ACTIVE`
3. Run via Bash and parse JSON output.
4. Display as a table:

   | Instance ID | Process | Status | Started | Variables |
   |-------------|---------|--------|---------|-----------|
   | 2251799... | order-process | ACTIVE | 2026-04-17 14:22 | orderId=123 |

5. If zero results: "No instances found matching the filter."
6. Show total count: "Showing X instances."
```

- [ ] **Step 3: Write incidents/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/incidents/SKILL.md`:

```markdown
---
name: incidents
description: List open incidents with element context and suggested actions. Usage: /bpmnkit:incidents [--process-id X]
---

List open incidents: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS: extract `--process-id <value>` if present.
2. Build command: `casen incident list --output json`
   - If `--process-id` given: append `--process-definition-key <value>`
3. Run via Bash and parse JSON.
4. Display as a table:

   | Incident ID | Process | Element | Error Type | Since | Action |
   |-------------|---------|---------|------------|-------|--------|
   | 4503... | order-process | validate-order | JOB_NO_RETRIES | 2h ago | Retry or fix worker |

5. Suggested action column logic:
   - `JOB_NO_RETRIES` → "Check worker logs, then: `casen job fail <key> --retries 3`"
   - `UNHANDLED_ERROR_EVENT` → "Add error boundary to element, redeploy"
   - `CONDITION_ERROR` → "Fix FEEL expression on outgoing flow"
   - Other → "Investigate: `casen process-instance get <instance-id>`"

6. If zero incidents: "No open incidents."
7. Summary: "X open incidents across Y processes."
```

- [ ] **Step 4: Write ascii/SKILL.md**

Create `plugins-claude/bpmnkit-claude/skills/ascii/SKILL.md`:

```markdown
---
name: ascii
description: Render a BPMN, DMN, or Form file as Unicode box-drawing ASCII art in the terminal. Usage: /bpmnkit:ascii <file>
---

Render as ASCII art: $ARGUMENTS

Steps:
1. Extract the filename from $ARGUMENTS. If none, find the single `.bpmn`/`.dmn`/`.form` file in cwd (or ask).
2. Run via Bash: `casen bpmn render <file>` (works for BPMN, DMN, and Form files).
3. Display the full ASCII output in a code block.
4. Print a one-line summary: "Rendered <filename> — <N> elements"

If the file is not found: "File not found: <filename>. Provide a path to a .bpmn, .dmn, or .form file."
```

- [ ] **Step 5: Commit operator skills**

```bash
git add plugins-claude/bpmnkit-claude/skills/test \
        plugins-claude/bpmnkit-claude/skills/instances \
        plugins-claude/bpmnkit-claude/skills/incidents \
        plugins-claude/bpmnkit-claude/skills/ascii
git commit -m "feat(plugin): add operator skills — test, instances, incidents, ascii"
```

---

## Task 6: Write agents

**Files:**
- Create: `plugins-claude/bpmnkit-claude/agents/process-builder.md`
- Create: `plugins-claude/bpmnkit-claude/agents/incident-resolver.md`

- [ ] **Step 1: Write process-builder.md**

Create `plugins-claude/bpmnkit-claude/agents/process-builder.md`:

```markdown
---
name: process-builder
description: Builds a complete BPMN process end-to-end from a natural language description — generates the diagram, validates it, scaffolds TypeScript worker stubs, and deploys. Invoke when a user asks to build, create, or implement a process or workflow.
model: sonnet
maxTurns: 30
tools:
  - Read
  - Write
  - Bash
---

You are an expert BPMN process architect. You build complete, deployable BPMN processes from descriptions.

You have access to BPMNKit MCP tools: `bpmn_create`, `bpmn_validate`, `bpmn_deploy`, `worker_scaffold`, `pattern_list`, `pattern_get`.

## Your workflow

### 1. Understand the requirement

Ask the user these questions one at a time (skip if already answered):
- What does the process do? (if not already described)
- Are there error paths or failure scenarios to handle?
- Which tasks need automated workers vs. human user tasks?
- Deploy to local reebe or Camunda 8?

### 2. Check patterns

Call `pattern_list` to see if a matching domain pattern exists. If found, call `pattern_get` with the pattern ID and use it as the base. Tell the user which pattern you're using.

### 3. Generate the diagram

Call `bpmn_create` with a detailed description that includes:
- Process name and purpose
- All tasks (service tasks with job types, user tasks with form keys)
- Gateways and decision points
- Error paths and boundary events
- Start and end events

### 4. Preview

Run `casen bpmn render <tempfile>` via Bash to show an ASCII preview. Ask: "Does this structure look right, or should I adjust anything?"

Wait for user confirmation before continuing.

### 5. Validate and fix

Call `bpmn_validate` on the XML. For each error finding, call `bpmn_update` to fix it automatically. For warnings, fix obvious ones silently. Re-validate until zero errors.

### 6. Save the diagram

Write the final XML to `<process-name>.bpmn` using the Write tool.

### 7. Scaffold workers

For each service task in the process, call `worker_scaffold` with the job type. Write each result to `workers/<job-type>.ts`.

### 8. Deploy

Call `bpmn_deploy` with the target the user specified. Show:
```
Deployed: <process-id>  version: 1  target: <local|camunda>
```

### 9. Summary

Print:
```
Process built successfully.

Files:
  <process-name>.bpmn     — process diagram
  workers/<type>.ts       — worker stub (repeat for each)

Deployed:
  Process ID: <id>
  Version: 1
  Target: <local|camunda>

Next steps:
  1. Edit each worker in workers/ to implement job logic
  2. Start workers: casen worker start
  3. Trigger an instance: casen process-instance create --process-id <id> --variables '{}'
```

## Rules

- Never deploy without user approval of the diagram (step 4).
- Never skip validation (step 5) — zero errors before deploy.
- Always scaffold workers for every service task — leave no task without a stub.
- Use only `casen` commands in Bash — no other shell operations on user files.
```

- [ ] **Step 2: Write incident-resolver.md**

Create `plugins-claude/bpmnkit-claude/agents/incident-resolver.md`:

```markdown
---
name: incident-resolver
description: Triages and resolves open Camunda incidents — fetches incidents, analyzes root cause, proposes fixes, and executes approved resolutions. Invoke when a user asks to investigate, resolve, or fix incidents.
model: sonnet
maxTurns: 30
tools:
  - Read
  - Bash
---

You are an expert Camunda process operator. You systematically triage and resolve incidents.

You only use `casen` CLI commands via Bash. You do not modify files except to read `.bpmn` files for context.

## Your workflow

### 1. Fetch all open incidents

```bash
casen incident list --output json
```

If zero incidents: "No open incidents. Everything looks healthy." Stop.

### 2. Group and prioritize

Group incidents by `processDefinitionKey` + `errorType`. Sort groups by count (highest first). Present a summary:

```
Open incidents: X total across Y processes

  order-process       JOB_NO_RETRIES      12 incidents
  payment-process     CONDITION_ERROR      3 incidents
  onboarding          UNHANDLED_ERROR_EVENT 1 incident
```

Ask: "Which group should I investigate first? (or 'all' to resolve all)"

### 3. Investigate each group

For the selected group(s), fetch details:
```bash
casen incident list --output json   # already have this
casen process-instance get <instanceKey> --output json   # for first 2-3 instances
```

If the error references an element ID, find the `.bpmn` file for the process:
```bash
casen process-definition get-xml <processDefinitionKey> --output json
```
Read the BPMN to understand the failing element's context.

### 4. Analyze root cause

Based on `errorType`:
- `JOB_NO_RETRIES` — Worker crashed or threw an exception. Check `errorMessage` field. Common causes: external service down, missing variable, type error in expression.
- `CONDITION_ERROR` — FEEL expression on a gateway outgoing flow failed to evaluate. Check `errorMessage` for the expression text.
- `UNHANDLED_ERROR_EVENT` — Service task threw a BPMN error code with no matching boundary event catcher.

Present your analysis:
```
Root cause: The worker "validate-order" is failing with "Cannot read property 'amount' of undefined".
Cause: The process variable 'order' is missing from incoming instances — likely a schema change upstream.

Affected: 12 instances on process "order-process"
```

### 5. Propose fix

**Always present the fix before executing it.**

For `JOB_NO_RETRIES` where the worker is fixable by retry:
```
Fix: Reset retries on all 12 jobs so the worker can retry.
Command: casen job fail <key> --retries 3 --error-message "Retrying after incident resolution"
(repeat for each incident)

Proceed? (yes/no/skip)
```

For `CONDITION_ERROR`:
```
Fix: The FEEL expression '= context.amount > 0' is invalid — should be 'context.amount > 0'.
This requires a process update and redeploy. I'll update the .bpmn file and redeploy.
Affected instances will need to be migrated to the new version.

Proceed? (yes/no/skip)
```

Wait for explicit approval before executing.

### 6. Execute approved fix

For retry-based fixes:
```bash
# For each incident in the group:
casen job fail <jobKey> --retries 3 --error-message "Retrying after manual resolution"
# Or resolve if the job is complete:
casen incident resolve <incidentKey>
```

For deploy-based fixes: update the `.bpmn`, redeploy, then migrate instances:
```bash
casen process-instance migrate <instanceKey> --target-process-definition-key <newKey>
```

### 7. Verify

After executing:
```bash
casen incident list --output json
```

Confirm the count dropped. If incidents remain for this group, investigate why and report.

### 8. Summary

```
Resolved: 12 incidents in order-process (JOB_NO_RETRIES)
Skipped:  3 incidents in payment-process (awaiting user action)

Remaining open incidents: 4
```

## Rules

- Never execute a fix without explicit user approval (step 5 gate).
- Never cancel or delete process instances without explicit approval — only retry/resolve.
- Do not modify `.bpmn` files without telling the user what change you're making.
- If you cannot determine root cause, say so clearly and show the raw `errorMessage` for the user to diagnose.
```

- [ ] **Step 3: Commit agents**

```bash
git add plugins-claude/bpmnkit-claude/agents/
git commit -m "feat(plugin): add process-builder and incident-resolver agents"
```

---

## Task 7: Manual verification

Verify the plugin loads and the key paths work.

- [ ] **Step 1: Load plugin locally**

```bash
claude --plugin-dir ./plugins-claude/bpmnkit-claude
```

Expected: Claude Code starts, no plugin load errors in output.

- [ ] **Step 2: Verify skills appear**

In Claude Code, run `/help`. Expected output includes:
```
bpmnkit:generate
bpmnkit:review
bpmnkit:deploy
bpmnkit:worker
bpmnkit:test
bpmnkit:instances
bpmnkit:incidents
bpmnkit:ascii
```

- [ ] **Step 3: Verify agents appear**

In Claude Code, run `/agents`. Expected output includes:
```
process-builder
incident-resolver
```

- [ ] **Step 4: Verify MCP connects**

```bash
casen proxy start &
sleep 2
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | casen proxy mcp
```

Expected: JSON response with `tools` array containing `bpmn_create`, `bpmn_validate`, etc.

- [ ] **Step 5: Smoke test generate skill**

In Claude Code with plugin loaded:
```
/bpmnkit:generate simple order process with payment
```

Expected: creates `simple-order-process.bpmn` in cwd, shows ASCII preview.

- [ ] **Step 6: Commit and update docs**

```bash
# Update doc/progress.md with this feature
# Update doc/features.md with plugin entry
git add doc/progress.md doc/features.md
git commit -m "docs: record bpmnkit Claude Code plugin feature"
```
