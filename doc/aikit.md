# AIKit — Intent-Driven Process Automation

Turn natural language into deployed, tested, production-ready BPMN processes.

> "I want to implement an invoice approval process."
> "Build me an employee onboarding workflow."
> "Automate our supplier contract review."

Claude autonomously plans the BPMN, audits available workers, scaffolds missing ones with real API integrations, validates, tests, and deploys — to reebe (local) or Camunda 8.

---

## Vision

The entry point is a **Claude Code skill**: `/implement "<any process description>"`.

The skill orchestrates everything: it reads domain patterns if one matches, spawns subagents (planner, implementer, reviewer, tester), calls BPMNKit via MCP, scaffolds standalone workers, runs simulations, and asks the user once — to approve and deploy.

Workers are **standalone TypeScript programs** that call the Zeebe/reebe REST API directly. No casen SDK required at runtime. They can run as Docker containers, serverless functions, or via `casen worker start` as a convenience.

BPMN stays visible — it is the review and approval surface for both technical and business users. Studio renders the result; AI builds it.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  INTENT LAYER                                       │
│  /implement "<any process description>"             │
│  casen CLI · Studio AI Drawer · Direct API          │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  ORCHESTRATION LAYER  (Claude Code Skills)          │
│  /implement · /review · /test · /deploy             │
│  Subagents: planner · implementer · reviewer ·      │
│             tester                                  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  MCP TOOL LAYER  (BPMNKit MCP Server)               │
│  bpmn_create · bpmn_update · bpmn_validate          │
│  bpmn_deploy · bpmn_simulate · bpmn_run_history     │
│  worker_list · worker_scaffold                      │
│  pattern_list · pattern_get                         │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  KNOWLEDGE LAYER  (packages/patterns/)              │
│  Domain BPMN templates · Worker maps · Notes        │
│  Optional: Claude derives structure from scratch    │
│  when no matching pattern exists                    │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  EXECUTION LAYER                                    │
│  reebe (local, drop-in) · Camunda 8 (cloud)         │
│  Pre-built workers · Scaffolded workers             │
└─────────────────────────────────────────────────────┘
```

---

## Full Flow

```
User: /implement "<process description>"
  │
  ├─ skill calls pattern_list() — checks for a matching domain pattern
  │    → if found: loads template BPMN + worker requirements as context
  │    → if not:   Claude derives structure from the description alone
  │
  ├─ [planner subagent]
  │    MCP: bpmn_create(description, context?)
  │    output: <process>.bpmn — opens in Studio for review
  │
  ├─ [implementer subagent]
  │    MCP: worker_list()
  │         → for each service task in the BPMN:
  │              existing worker found  → wire jobType, done
  │              pre-built package found → install + wire, done
  │              nothing found          → worker_scaffold(taskType, spec)
  │                                       generates workers/<name>/index.ts
  │
  ├─ [reviewer subagent]
  │    MCP: bpmn_validate(<process>.bpmn)
  │         → auto-fixes pattern violations (error boundaries, timeouts, ...)
  │         → flags anything requiring human judgment
  │
  ├─ [tester subagent]
  │    derives scenario matrix from BPMN structure (happy path + edge cases)
  │    MCP: bpmn_simulate(<process>.bpmn, scenarios)
  │    surfaces failures with variable diffs and suggested fixes
  │
  └─ Claude presents summary:
       · BPMN file + Studio link
       · Workers reused / installed / scaffolded
       · Pattern issues found and fixed
       · Test results: N/M pass, open items
       · Secrets required (if any)
       · Deploy to: reebe (local) or Camunda 8?
```

---

## Phases

---

### Phase 1 — MCP Foundation

Expand `apps/proxy/src/mcp-server.ts` into the complete programmatic interface for BPMNKit. Everything else in this plan depends on these tools being callable from Claude.

**BPMN tools**

- [x] `bpmn_create(description, context?)` — calls existing AI endpoint, returns compact BPMN path
- [x] `bpmn_read(path)` — returns compact representation of an existing file
- [x] `bpmn_update(path, instruction)` — calls existing improve endpoint, writes result
- [x] `bpmn_validate(path)` — runs pattern advisor + schema validation, returns findings
- [x] `bpmn_deploy(path, target)` — deploys to reebe or Camunda 8 (target: `"local" | "camunda8"`)
- [x] `bpmn_simulate(path, scenarios[])` — runs process-runner scenarios, returns pass/fail + diffs
- [x] `bpmn_run_history(processId)` — queries SQLite run history, returns recent executions

**Worker tools**

- [x] `worker_list()` — returns catalog of all available workers (built-in + installed) with jobType, inputs, outputs, and source
- [x] `worker_scaffold(jobType, spec)` — generates standalone TypeScript worker into `workers/<name>/index.ts`

**Pattern tools**

- [x] `pattern_list()` — returns available domain patterns with name, description, and matched keywords
- [x] `pattern_get(domain)` — returns full pattern: compact BPMN template + worker requirements + notes

**Infrastructure**

- [x] Wire all tools into existing MCP stdio server
- [x] Write MCP tool integration tests (call each tool via MCP protocol)
- [x] Verify Claude Code can discover and call tools via `.claude/mcp.json` project config

---

### Phase 2 — Pattern Library

Static domain knowledge files. Claude calls `pattern_list()` at the start of every `/implement` run to check for a match. If one exists it loads it as context — if not, Claude derives the process structure from the description alone.

Patterns are hints, not rigid templates. Claude adapts them to the user's specific request.

**Format**

- [x] Create `packages/patterns/` with a README explaining the schema
- [x] Define the pattern schema:
  - `README.md` — domain context, common variations, relevant regulations or conventions
  - `template.bpmn` — representative flow in compact format (starting point, not fixed output)
  - `workers.yaml` — typical service tasks: jobType, inputs, outputs, integration options
  - `keywords.txt` — terms Claude uses to match this pattern to a user request

**Seed patterns** (representative spread across domains)

- [x] `invoice-approval/` — finance / accounts payable
- [x] `employee-onboarding/` — HR
- [x] `supplier-contract-review/` — procurement / legal
- [x] `incident-response/` — IT / ops
- [x] `loan-origination/` — financial services
- [x] `content-moderation/` — trust & safety
- [x] `order-fulfillment/` — e-commerce / supply chain

---

### Phase 3 — Standalone Worker Infrastructure

Workers call the Zeebe/reebe REST API directly. No casen SDK at runtime.

**Zeebe REST client**

- [ ] Create `packages/worker-client/` — thin TypeScript wrapper (~100 lines)
  - [ ] `poll(jobType, maxJobs?)` — async iterator over activated jobs
  - [ ] `job.complete(variables)` — complete a job
  - [ ] `job.fail(message, retries?)` — fail a job
  - [ ] `job.throwError(code, message)` — throw BPMN error
  - [ ] Reads `ZEEBE_ADDRESS` (and optional `ZEEBE_CLIENT_ID`, `ZEEBE_CLIENT_SECRET`) from env
  - [ ] Works against both reebe and Camunda 8 (same REST spec)

**Worker scaffolder** (`worker_scaffold` MCP tool implementation)

- [ ] Generate `workers/<name>/index.ts` from spec — typed inputs/outputs, error handling, logging
- [ ] Generate `workers/<name>/package.json` — standalone, only depends on `@bpmnkit/worker-client`
- [ ] Generate `workers/<name>/README.md` — required env vars, how to run
- [ ] `casen worker start [name]` convenience command — starts worker process(es), not required

**Worker registry**

- [ ] `apps/proxy/src/worker-registry.ts` — scans `workers/` dir, reads each worker's metadata
- [ ] Powers `worker_list()` MCP tool
- [ ] Includes built-in workers (llm, cli, http, fs, js, email) in the catalog

---

### Phase 4 — Claude Code Skills

The `/implement` skill and its companions. Lives in `.claude/skills/` — shipped alongside the CLI so users get it automatically when they install casen.

**`/implement` skill**

- [ ] `SKILL.md` — main orchestration: calls `pattern_list()`, spawns 4 subagents in sequence, presents summary, asks for deploy confirmation
- [ ] `planner.md` — subagent: interpret request, load pattern if matched, call `bpmn_create()`, surface result in Studio
- [ ] `implementer.md` — subagent: call `worker_list()`, match each service task to an existing or pre-built worker, call `worker_scaffold()` for gaps, wire all jobTypes into BPMN
- [ ] `reviewer.md` — subagent: call `bpmn_validate()`, auto-fix pattern violations, flag items requiring human judgment
- [ ] `tester.md` — subagent: derive scenario matrix from BPMN structure, call `bpmn_simulate()`, surface failures with context
- [ ] End-to-end test: run `/implement` with a sample description in dry-run mode, verify all 4 subagents produce expected artifacts

**`/review` skill** (standalone BPMN review)

- [ ] `SKILL.md` — calls `bpmn_validate()`, produces structured finding report with severity and fix suggestions
- [ ] Usable on any existing BPMN file: `/review path/to/process.bpmn`

**`/test` skill** (standalone test generation)

- [ ] `SKILL.md` — generates scenario matrix from BPMN, calls `bpmn_simulate()`, reports coverage
- [ ] Writes scenarios to `.bpmn.tests.json` sidecar if not present, merges if it exists

**`/deploy` skill** (standalone deploy)

- [ ] `SKILL.md` — calls `bpmn_deploy()`, starts any scaffolded workers, confirms running state
- [ ] Usable standalone after manual edits: `/deploy path/to/process.bpmn`

**Skill distribution**

- [ ] Ship skills in `apps/cli/` so `casen` installs them into `.claude/skills/` on first run
- [ ] `casen skills install` command — (re)installs skills from bundled definitions
- [ ] Document skill invocation in `casen --help` output

---

### Phase 5 — Docs (`apps/docs`)

Update the public documentation site to reflect all new capabilities.

- [ ] New page: `content/docs/guides/ai-implement.mdx` — walkthrough of `/implement`, from intent to deployed process, with multiple example process types
- [ ] New page: `content/docs/guides/workers-standalone.mdx` — how standalone workers work, scaffolding, deployment options (Docker / PM2 / `casen worker start`)
- [ ] New page: `content/docs/packages/worker-client.mdx` — `@bpmnkit/worker-client` API reference
- [ ] New page: `content/docs/guides/patterns.mdx` — pattern library: format, how Claude uses them, how to contribute new patterns
- [ ] Update: `content/docs/cli/` — document `/implement`, `/review`, `/test`, `/deploy` skills and `casen skills install`
- [ ] Update: `content/docs/getting-started/` — mention AI-first workflow as the recommended entry point
- [ ] Update `doc/features.md` — add AIKit section listing all new capabilities
- [ ] Update `doc/roadmap.md` — add AIKit phases and check items as they complete
- [ ] Update `doc/progress.md` — changelog entry for each phase as shipped

---

## Worker Lifecycle (Option C)

Scaffolded into the project, runnable anywhere, casen as convenience:

```
project/
  <process>.bpmn              ← generated by /implement
  workers/
    <task-name>/
      index.ts                ← generated by worker_scaffold()
      package.json            ← standalone, no bpmnkit deps
      Dockerfile              ← for containerized deployment
      README.md               ← required env vars, how to run
    <task-name-2>/
      ...

# Run directly
node workers/<task-name>/index.js

# Run via Docker
docker run -e API_KEY=... bpmnkit/<task-name>

# Run via casen (convenience, not required)
casen worker start
casen worker start <task-name>
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Worker runtime dependency | None (plain Node.js) | Workers must run anywhere without BPMNKit installed |
| `@bpmnkit/worker-client` | Thin in-repo wrapper | Avoids SDK lock-in; reebe and Camunda 8 share the same REST spec |
| Domain knowledge | Static pattern files | Predictable, version-controlled, token-efficient; Claude fills gaps when no pattern matches |
| Skill entry point | Claude Code skill (`/implement`) | Composable, portable across projects, works in terminal and IDE |
| BPMN review surface | Studio (existing) | Business users already have it; no new UI needed |
| Worker integration abstraction | Provider-selectable via env var | Swap providers without code changes; works for any integration category |
| Pattern matching | Keyword-based + Claude judgment | Patterns are hints not constraints; Claude adapts or ignores them as needed |
