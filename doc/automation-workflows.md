# Local Automation Workflows

## Vision

bpmnkit becomes a self-hosted, local-first automation platform where BPMN is not just a modeling
notation but the **runtime contract** between humans, AI, and external systems.

A non-technical user draws a flow — "check emails → AI evaluates each → aggregate → write report" —
and it runs. No script. No cloud account. No proprietary node-graph editor.

The differentiators versus n8n / Zapier / Make:
- **Standard BPMN** — the diagram IS the documentation, learnable and transferable
- **First-class error semantics** — boundary events, retries, compensation, sub-process scope, all native
- **AI designs and executes** — the same LLM that helps model the diagram can be called as a task inside it
- **Fully local** — no usage limits, no vendor lock-in, works offline

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  User draws BPMN in Studio                                       │
│  ↓ deploys to reebe (local Rust engine)                         │
│  ↓ starts process instance                                       │
└─────────────────────────────────────────────────────────────────┘
          ↓ jobs appear in reebe's job queue
┌─────────────────────────────────────────────────────────────────┐
│  Worker Daemon (runs inside bpmn-ai-server / proxy)              │
│  ↓ polls  POST /v2/jobs/activation  for each registered type     │
│  ↓ dispatches to built-in handler                               │
│  ↓ posts result to  POST /v2/jobs/:key/completion               │
└─────────────────────────────────────────────────────────────────┘
          ↓ handled by
┌────────────────────────────┐  ┌─────────────────────────────────┐
│  Built-in workers          │  │  User-defined CLI commands       │
│  · LLM (Claude/GPT/Gemini) │  │  Any shell command can become   │
│  · File system (R/W/list)  │  │  a BPMN service task             │
│  · HTTP REST connector     │  │                                  │
│  · Email (IMAP/SMTP)       │  │                                  │
│  · JavaScript eval         │  │                                  │
└────────────────────────────┘  └─────────────────────────────────┘
```

Built-in workers are configured via **element templates** — pre-built task configurations with a
form UI so users never write FEEL or edit raw XML.

---

## Job Type Contract

All built-in workers follow this convention:

| Aspect | Convention |
|---|---|
| **Job type** | `io.bpmnkit:<name>:<version>` |
| **Primary inputs** | Process variables (set via IO mapping) |
| **Static config** | Zeebe task headers (set at design time, never change at runtime) |
| **Secrets** | `{{secrets.NAME}}` in any header or variable value |
| **Outputs** | Returned as output variables via `job.complete({ ... })` |
| **Errors** | Job fails → incident created → visible in Studio |

---

## Phase 1 — Worker Daemon & Core Workers

**Goal:** Something real runs. A user can draw a BPMN, deploy to local reebe, and have the diagram
actually execute shell commands, call an LLM, and read/write files.

### Action items

- [x] `apps/proxy/src/worker.ts` — Worker daemon class
  - Polls `POST /v2/jobs/activation` for all registered job types (1 s interval)
  - Dispatches to registered handler functions
  - Completes/fails via `POST /v2/jobs/:key/completion|failure`
  - Reads active profile from CLI config (same as proxy)
  - Graceful start/stop; logs each job start + result
  - `startWorkerDaemon()` called from `index.ts` on server startup
  - `BPMNKIT_WORKERS=false` env var to opt out
  - Worker status exposed on `GET /status`

- [x] `apps/proxy/src/workers/cli.ts` — Shell command worker (`io.bpmnkit:cli:1`)
  - Header `command` — template string, e.g. `echo "{{greeting}}"` — interpolated with process variables
  - Header `cwd` (optional) — working directory, default `~`
  - Header `timeout` (optional) — seconds, default 60
  - Outputs: `{ stdout: string, stderr: string, exitCode: number }`
  - Fails job if exit code ≠ 0 (unless header `ignoreExitCode=true`)

- [x] `apps/proxy/src/workers/llm.ts` — LLM worker (`io.bpmnkit:llm:1`)
  - Variable `prompt` — the prompt text (supports `{{variable}}` interpolation)
  - Header `system` (optional) — system prompt
  - Header `model` (optional) — `claude` | `copilot` | `gemini`, auto-detects if omitted
  - Header `resultVariable` (optional) — variable name to store response, default `response`
  - Outputs: `{ response: string }` (or `{ [resultVariable]: string }`)
  - Reuses existing `claude` / `copilot` / `gemini` adapters from proxy

- [x] `apps/proxy/src/workers/fs.ts` — File system workers
  - `io.bpmnkit:fs:read:1` — variable/header `path` → output `{ content: string }`
  - `io.bpmnkit:fs:write:1` — variable `path`, variable `content` → writes file, output `{ bytesWritten: number }`
  - `io.bpmnkit:fs:list:1` — variable/header `path` → output `{ files: string[] }` (relative paths)
  - `io.bpmnkit:fs:append:1` — like write but appends

- [x] `apps/proxy/src/workers/js.ts` — JavaScript eval worker (`io.bpmnkit:js:1`)
  - Header `expression` — a JS expression string, e.g. `variables.items.filter(x => x.score > 0.5)`
  - All process variables available as `variables` object
  - Output: `{ result: unknown }` — the expression return value
  - Runs in a `new Function(...)` sandbox (no `require`/`import`)

- [x] Wire daemon into `apps/proxy/src/index.ts`
  - Starts daemon after server is ready
  - Worker status in `GET /status` response: `{ workers: { active, jobTypes, pollCount, lastError } }`
  - `BPMNKIT_WORKERS=false` env var to opt out

- [x] `apps/proxy/src/worker-templates.ts` — Element template definitions (JSON)
  - One template per job type (CLI, LLM, FS×4, JS), following Camunda element template schema
  - Served via `GET /worker-templates`

- [x] Update `packages/plugins/src/connector-catalog/` to show built-in templates
  - Added optional `proxyUrl` option to `createConnectorCatalogPlugin()`
  - On install, fetches `GET /worker-templates` and registers all built-in worker templates
  - Studio passes proxy URL automatically from `useClusterStore`

- [x] Tests: `apps/proxy/tests/worker.test.ts`
  - 19 tests: `interpolate()` (variables, secrets, missing), CLI worker (exec, interpolation, exit code, resultVariable), FS workers (read/write/append/list, parent dirs, resultVariable)

---

## Phase 2 — Trigger Infrastructure

**Goal:** Workflows start automatically. No manual "Run" click needed.

### Action items

- [x] `apps/proxy/src/triggers/timer.ts` — Timer trigger scheduler
  - On startup, queries reebe for deployed processes with timer start events
  - Parses ISO 8601 `timeDuration`, `timeDate`, `timeCycle` from BPMN XML
  - Fires `POST /v2/process-instances` at the right time; ticks every 5 s
  - Reschedules after each fire for repeating timers (`R/PT1H`)
  - Persists last-fired timestamps to `~/.bpmnkit/timer-state.json` to survive restarts

- [x] `apps/proxy/src/triggers/file-watcher.ts` — File watcher trigger
  - Service task type `io.bpmnkit:trigger:file-watch:1` with task header `watchPath`
  - Uses `node:fs.watch` to monitor a folder (no extra dependencies)
  - New/modified file → start process instance with `{ filePath, fileName, fileContent, relativePath, eventType }` variables
  - Header `glob` to filter by filename pattern
  - Header `events`: `add` | `change` | `all`

- [x] `apps/proxy/src/triggers/webhook.ts` — Webhook trigger
  - `POST /webhooks/:processId` → starts a process instance with the request body as variables
  - Optionally secured with `WEBHOOK_TOKEN` env var (`Authorization: Bearer <token>`)
  - Response: `{ processInstanceKey }` immediately; async execution

- [ ] Studio: "Run" button improvements
  - Show a trigger dropdown: Manual / On Timer / On Webhook / On File
  - For manual trigger, show variable input form before starting
  - Display the webhook URL for copy-paste after deploy

- [x] `apps/proxy/src/triggers/index.ts` — Trigger orchestrator
  - Starts timer + file-watch triggers on startup; exports webhook route handler
  - Respects `BPMNKIT_TRIGGERS=false`

---

## Phase 3 — Element Templates & Connector UX

**Goal:** Users configure workers via form UI, never touching BPMN XML or FEEL expressions directly.

### Action items

- [x] Finalize element template schema for built-in workers (`apps/proxy/src/worker-templates.ts`)
  - All 8 workers have: property `id`s, `constraints.notEmpty` on required fields, proper groups, icons
  - Added File Watch Trigger template (`io.bpmnkit.trigger.file-watch:1`)
  - Using modern `zeebe:taskDefinition` binding with `property: "type"`

- [x] `packages/plugins/src/config-panel-bpmn/` — template form renderer
  - The existing `buildRegistrationFromTemplate()` handles all worker template field types
  - String with `feel: "optional"` → FEEL expression field with toggle (used for prompts, paths, content)
  - Dropdown → searchable select (used for model, events)
  - Boolean → toggle (used for ignoreExitCode)
  - Number → text with numeric placeholder (used for timeout)
  - Secrets: `{{secrets.NAME}}` works in any String/Text/FEEL field (documented in field hints)

- [x] Connector catalog plugin — "Built-in" tab and "Community" tab
  - `packages/plugins/src/connector-catalog/builtin-templates.ts` — 8 static templates, always available
  - `packages/plugins/src/connector-catalog/panel.ts` — `CatalogPanel` DOM component
  - "Built-in Workers" tab: card grid with icon, name, description, Use button; search filter
  - "Community APIs" tab: scrollable list of 30+ OpenAPI entries; search filter
  - "Browse connectors…" command in palette opens the panel
  - Plugin now exports `openCatalog()` method for programmatic access
  - Static templates auto-registered at install time (no proxy required)
  - `ConnectorCatalogPlugin` interface exported with `openCatalog()`

- [x] Static built-in catalog: `packages/plugins/src/connector-catalog/builtin-templates.ts`
  - 8 worker templates typed as the plugin's `ElementTemplate` — no proxy dependency

- [x] Template-to-BPMN serialization round-trip tests (`packages/plugins/tests/config-panel-bpmn/template-round-trip.test.ts`)
  - 21 tests: in-memory write→read round-trips for all 6 main worker types
  - XML serialize→parse round-trips verifying field preservation and modelerTemplate stamping
  - Parameterized test verifying all 8 templates write the correct zeebe:taskDefinition type

---

## Phase 4 — Multi-Instance & Flow UX

**Goal:** "For each email, do X" is as easy to configure as any other node.

### Action items

- [x] `packages/plugins/src/config-panel-bpmn/` — multi-instance panel
  - Detect when a sub-process is selected
  - Toggle: Sequential / Parallel / None
  - Collection expression input (FEEL): `= emails` — the array to iterate over
  - Element variable input: `email` — name for the current item in each iteration
  - Completion condition (optional): short-circuit when condition is true
  - Visual indicator on canvas: the ≡ / ‖ markers on sub-process borders

- [ ] Engine: multi-instance sub-process execution
  - Sequential: execute iterations one at a time, same instance scope
  - Parallel: spawn N child scopes simultaneously, wait for all to complete
  - Aggregate outputs: collect `outputElement` into parent-scope array

- [ ] Variable flow plugin: show iteration variable in scope tooltip

- [ ] Guided "for each" modal in Studio
  - When user clicks a sub-process: "Process each item in a list?" → configures multi-instance
  - Plain-English summary: "Runs once for each item in `emails`, in parallel"

---

## Phase 5 — Observability & Audit

**Goal:** Users can see what happened, debug failures, and review AI outputs without leaving Studio.

### Action items

- [ ] `apps/proxy/src/routes/run-history.ts` — local run history store
  - SQLite (via `better-sqlite3`) at `~/.bpmnkit/run-history.db`
  - Schema: `runs(id, processId, startedAt, endedAt, state, variables_snapshot)`
  - Schema: `steps(id, runId, elementId, elementName, startedAt, endedAt, state, inputs, outputs)`
  - `GET /run-history` — paginated list of runs
  - `GET /run-history/:id` — full run detail with steps

- [ ] Studio: Run History page
  - Timeline view: sequence of completed elements with timestamps
  - Variable state at each step (diff from previous)
  - AI step outputs highlighted inline
  - Failure details: error message, element where it failed

- [ ] LLM worker: log prompts + responses to run history
  - Full prompt (after variable interpolation) stored in step `inputs`
  - Response stored in step `outputs`
  - Allows replay/debugging of AI calls

- [ ] CLI worker: log command + stdout/stderr to run history

- [ ] Studio: inline "re-run from here" for failed instances
  - Select a step → restart from that point with optional variable overrides
  - Requires reebe API support for updating variables + retrying a step

---

## Phase 6 — Polish & Ecosystem

**Goal:** The platform is ready for real users, not just power users.

### Action items

- [ ] Email worker (`io.bpmnkit:email:fetch:1`, `io.bpmnkit:email:send:1`)
  - IMAP fetch: returns array of `{ subject, from, body, date }` objects
  - SMTP send: inputs `to`, `subject`, `body` (HTML or plain text)
  - Credentials via `{{secrets.*}}`

- [ ] HTTP scraper worker (`io.bpmnkit:http:scrape:1`)
  - Fetches a URL, returns `{ html, text, title }` using `node:fetch` + simple HTML stripper
  - Useful for "open each link and summarize"

- [ ] Process template library
  - 5–10 ready-to-import BPMN files covering common patterns:
    - "Summarize a folder of documents"
    - "Monitor a URL and alert on change"
    - "Weekly digest email from RSS feeds"
    - "Code review assistant — watch a folder, AI reviews new files"

- [ ] Studio onboarding: "What would you like to automate?"
  - AI chat that generates a starter BPMN based on the user's description
  - Uses the existing AI diagram generation feature

- [ ] Worker security hardening
  - CLI worker: optional `allowedCommands` allowlist in proxy config
  - FS worker: optional `rootDir` restriction (like existing `fsValidate`)
  - JS worker: stricter sandbox (VM module)

---

## Element Template Reference

All built-in workers are defined as element templates. Schema summary:

```jsonc
{
  "id": "io.bpmnkit.cli",
  "name": "CLI Command",
  "version": 1,
  "description": "Run any shell command",
  "appliesTo": ["bpmn:ServiceTask"],
  "icon": { "contents": "<svg>…</svg>" },
  "category": { "id": "bpmnkit", "name": "Built-in" },
  "properties": [
    // Task definition
    { "type": "Hidden", "binding": { "type": "zeebe:taskDefinition:type" }, "value": "io.bpmnkit:cli:1" },
    // Configurable headers
    { "label": "Command", "type": "String", "binding": { "type": "zeebe:taskHeader", "key": "command" } },
    { "label": "Working directory", "type": "String", "optional": true, "binding": { "type": "zeebe:taskHeader", "key": "cwd" } },
    { "label": "Timeout (seconds)", "type": "Number", "value": 60, "binding": { "type": "zeebe:taskHeader", "key": "timeout" } },
    // Output variable
    { "label": "Result variable", "type": "String", "value": "cliResult", "binding": { "type": "zeebe:taskHeader", "key": "resultVariable" } }
  ]
}
```

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Worker daemon location | Inside `apps/proxy` | Already running, has profile access, no new process to manage |
| Job poll interval | 500 ms + long-poll | Low latency, low CPU; long-poll if reebe supports it |
| LLM adapter reuse | Yes — reuse `claude`/`copilot`/`gemini` from proxy | DRY, same detection logic |
| Run history storage | SQLite via `better-sqlite3` | Zero-infrastructure, file-based, queryable |
| Template format | Camunda element template schema | Compatible with Camunda tooling, existing `config-panel-bpmn` |
| Multi-instance | Parallel first, sequential second | Most useful for AI fan-out patterns |
| Security (CLI) | Opt-in allowlist, warn-only by default | Developer-first, not locked down |

---

## Non-Goals

- Cloud execution (all workers run on the machine running the proxy)
- Visual debugging step-by-step in the browser (covered by existing simulation mode)
- Replacing n8n for complex enterprise integrations (bpmnkit targets local + developer use)
- Long-running persistent workers beyond what BPMN process scope provides
