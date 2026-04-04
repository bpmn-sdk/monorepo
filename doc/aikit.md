# AIKit — Intent-Driven Process Automation

Turn natural language into deployed, tested, production-ready BPMN processes.

> "I want to implement a KYC process for a bank."

Claude autonomously plans the BPMN, audits available workers, scaffolds missing ones with real API integrations, validates, tests, and deploys — to reebe (local) or Camunda 8.

---

## Vision

The entry point is a **Claude Code skill**: `/implement "KYC process for a bank"`.

The skill orchestrates everything: it reads domain patterns, spawns subagents (planner, implementer, reviewer, tester), calls BPMNKit via MCP, scaffolds standalone workers, runs simulations, and asks the user once — to approve and deploy.

Workers are **standalone TypeScript programs** that call the Zeebe/reebe REST API directly. No casen SDK required at runtime. They can run as Docker containers, serverless functions, or via `casen worker start` as a convenience.

BPMN stays visible — it is the review and approval surface for both technical and business users. Studio renders the result; AI builds it.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  INTENT LAYER                                       │
│  /implement "KYC process"                           │
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
│  kyc · loan-origination · employee-onboarding       │
│  invoice-approval · ...                             │
│  Domain BPMN templates · Worker maps · Regs notes   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  EXECUTION LAYER                                    │
│  reebe (local, drop-in) · Camunda 8 (cloud)         │
│  Standalone workers · Real API integrations         │
└─────────────────────────────────────────────────────┘
```

---

## Full Flow Example

```
User: /implement "KYC process for a bank"
  │
  ├─ skill reads: patterns/kyc/ (FATF context, 4 required workers, standard BPMN)
  │
  ├─ [planner subagent]
  │    MCP: bpmn_create("KYC retail: identity verify → AML screen →
  │                      doc verify → risk score → manual review gate")
  │    output: kyc-process.bpmn (opens in Studio for review)
  │
  ├─ [implementer subagent]
  │    MCP: worker_list()
  │         → identity-verify:   EXISTS (built-in connector)
  │         → aml-screen:        EXISTS (Refinitiv connector)
  │         → document-verify:   MISSING
  │         → risk-score:        MISSING
  │    MCP: worker_scaffold("document-verify", spec)
  │         → workers/document-verify/index.ts  (AWS Textract integration)
  │    MCP: worker_scaffold("risk-score", spec)
  │         → workers/risk-score/index.ts  (pure logic, no external API)
  │
  ├─ [reviewer subagent]
  │    MCP: bpmn_validate(kyc-process.bpmn)
  │         → missing error boundary on AML screen task → auto-fixes
  │         → no timeout on manual review gate → adds timer boundary
  │
  ├─ [tester subagent]
  │    generates scenarios: happy path, identity fail, AML match,
  │                         doc tampered, manual-review timeout
  │    MCP: bpmn_simulate(kyc-process.bpmn, scenarios)
  │    output: 4/5 pass — manual-review timeout path needs input
  │
  └─ Claude presents:
       "Built:
        · BPMN: kyc-process.bpmn [view in Studio]
        · 2 workers scaffolded: document-verify, risk-score
        · 2 workers already existed: identity-verify, aml-screen
        · 2 pattern issues found and fixed
        · Tests: 4/5 pass — manual-review timeout needs your input
        Secrets required: TEXTRACT_KEY, REFINITIV_KEY, ONFIDO_KEY
        Deploy to: reebe (local) or Camunda 8?"
```

---

## Phases

---

### Phase 1 — MCP Foundation

Expand `apps/proxy/src/mcp-server.ts` into the complete programmatic interface for BPMNKit. Everything else in this plan depends on these tools being callable from Claude.

**BPMN tools**

- [ ] `bpmn_create(description, domain?)` — calls existing AI endpoint, returns compact BPMN path
- [ ] `bpmn_read(path)` — returns compact representation of an existing file
- [ ] `bpmn_update(path, instruction)` — calls existing improve endpoint, writes result
- [ ] `bpmn_validate(path)` — runs pattern advisor + schema validation, returns findings
- [ ] `bpmn_deploy(path, target)` — deploys to reebe or Camunda 8 (target: `"local" | "camunda8"`)
- [ ] `bpmn_simulate(path, scenarios[])` — runs process-runner scenarios, returns pass/fail + diffs
- [ ] `bpmn_run_history(processId)` — queries SQLite run history, returns recent executions

**Worker tools**

- [ ] `worker_list()` — returns catalog of all available workers (built-in + installed) with jobType, inputs, outputs, and source
- [ ] `worker_scaffold(jobType, spec)` — generates standalone TypeScript worker into `workers/<name>/index.ts`

**Pattern tools**

- [ ] `pattern_list()` — returns available domain patterns with descriptions
- [ ] `pattern_get(domain)` — returns full pattern: compact BPMN template + workers.yaml + notes

**Infrastructure**

- [ ] Wire all tools into existing MCP stdio server
- [ ] Write MCP tool integration tests (call each tool via MCP protocol)
- [ ] Verify Claude Code can discover and call tools via `.claude/mcp.json` project config

---

### Phase 2 — Pattern Library

Static domain knowledge files. Claude reads these at design time to avoid asking basic questions.

**Structure**

- [ ] Create `packages/patterns/` with a clear README explaining the format
- [ ] Define the pattern schema: `README.md` (domain context, regulations), `template.bpmn` (compact), `workers.yaml` (required workers spec), `variations.md` (common customizations)

**KYC pattern** (first, used as reference implementation)

- [ ] `kyc/README.md` — FATF guidelines, AML directives, simple vs enhanced due diligence
- [ ] `kyc/template.bpmn` — standard KYC flow in compact format
- [ ] `kyc/workers.yaml` — identity-verify, aml-screen, document-verify, risk-score specs with real API options
- [ ] `kyc/variations.md` — retail vs corporate, jurisdictions, manual review thresholds

**Additional patterns** (after KYC is validated end-to-end)

- [ ] `loan-origination/`
- [ ] `employee-onboarding/`
- [ ] `invoice-approval/`

---

### Phase 3 — Standalone Worker Infrastructure

Workers call the Zeebe/reebe REST API directly. No casen SDK at runtime.

**Zeebe REST client**

- [ ] Create `packages/zeebe-client/` — thin TypeScript wrapper (~100 lines)
  - [ ] `poll(jobType, maxJobs?)` — async iterator over activated jobs
  - [ ] `job.complete(variables)` — complete a job
  - [ ] `job.fail(message, retries?)` — fail a job
  - [ ] `job.throwError(code, message)` — throw BPMN error
  - [ ] Reads `ZEEBE_ADDRESS` (and optional `ZEEBE_CLIENT_ID`, `ZEEBE_CLIENT_SECRET`) from env
  - [ ] Works against both reebe and Camunda 8 (same REST spec)

**Worker scaffolder** (`worker_scaffold` MCP tool implementation)

- [ ] Generate `workers/<name>/index.ts` from spec — typed inputs/outputs, error handling, logging
- [ ] Generate `workers/<name>/package.json` — standalone, no bpmnkit dependencies
- [ ] Generate `workers/<name>/README.md` — required env vars, how to run
- [ ] `casen worker start [name]` convenience command — starts worker process(es), not required

**Worker registry**

- [ ] `apps/proxy/src/worker-registry.ts` — scans `workers/` dir, reads each worker's metadata
- [ ] Powers `worker_list()` MCP tool
- [ ] Includes built-in workers (llm, cli, http, fs, js, email) in the catalog

---

### Phase 4 — Real Service Worker Integrations

Pre-built workers for common real-world APIs. Each is a standalone `@bpmnkit/worker-*` package.

**Identity verification** (`packages/worker-identity/`)

- [ ] Onfido integration — document + biometric verification
- [ ] Jumio integration — identity proofing
- [ ] Persona integration — KYC orchestration API
- [ ] Unified interface: inputs `{ firstName, lastName, dateOfBirth, documentImage }`, outputs `{ status, score, flags }`
- [ ] Configurable via `IDENTITY_PROVIDER` env var

**AML / sanctions screening** (`packages/worker-aml/`)

- [ ] Refinitiv World-Check integration
- [ ] Dow Jones Risk & Compliance integration
- [ ] Inputs: `{ fullName, dateOfBirth, nationality }`, outputs: `{ result, matchedLists, riskLevel }`

**Document processing** (`packages/worker-document/`)

- [ ] AWS Textract integration
- [ ] Google Document AI integration
- [ ] Inputs: `{ documentImage, documentType }`, outputs: `{ isAuthentic, extractedData, expiryDate }`

**Notification workers** (`packages/worker-notify/`)

- [ ] Email (reuse existing `io.bpmnkit:email:send:1` logic, standalone wrapper)
- [ ] Slack webhook
- [ ] Generic webhook

**For each worker package**

- [ ] TypeScript strict, zero dependencies beyond `@bpmnkit/zeebe-client`
- [ ] Unit tests with mocked API responses
- [ ] Integration test (with `TEST_LIVE=true` env flag for real API calls)
- [ ] Dockerfile for containerized deployment

---

### Phase 5 — Claude Code Skills

The `/implement` skill and its companions. Lives in `.claude/skills/` — shipped alongside the CLI so users get it automatically.

**`/implement` skill**

- [ ] `SKILL.md` — main orchestration: reads pattern, spawns 4 subagents in sequence, presents summary, asks for deploy confirmation
- [ ] `planner.md` — subagent instructions: interpret domain, call `pattern_get()`, call `bpmn_create()`, open in Studio
- [ ] `implementer.md` — subagent instructions: call `worker_list()`, identify gaps, call `worker_scaffold()` for each missing worker, wire job types into BPMN
- [ ] `reviewer.md` — subagent instructions: call `bpmn_validate()`, auto-fix pattern violations, flag compliance gaps
- [ ] `tester.md` — subagent instructions: derive scenario matrix from BPMN structure, call `bpmn_simulate()`, surface failures with context
- [ ] End-to-end test: run `/implement "KYC process for a bank"` in dry-run mode, verify all 4 subagents fire and produce expected artifacts

**`/review` skill** (standalone BPMN review, no implementation)

- [ ] `SKILL.md` — calls `bpmn_validate()`, produces structured finding report with severity and fix suggestions
- [ ] Usable on any existing BPMN file: `/review path/to/process.bpmn`

**`/test` skill** (standalone test generation)

- [ ] `SKILL.md` — generates scenario matrix from BPMN, calls `bpmn_simulate()`, reports coverage
- [ ] Writes scenarios to `.bpmn.tests.json` sidecar if not present, merges if exists

**Skill distribution**

- [ ] Ship skills in `apps/cli/` so `casen` installs them into `.claude/skills/` on first run
- [ ] `casen skills install` command — (re)installs skills from bundled definitions
- [ ] Document skill invocation in `casen --help` output

---

### Phase 6 — Docs (`apps/docs`)

Update the public documentation site to reflect all new capabilities.

- [ ] New page: `content/docs/guides/ai-implement.mdx` — walkthrough of `/implement`, from intent to deployed process, with KYC example
- [ ] New page: `content/docs/guides/workers-standalone.mdx` — how standalone workers work, how to scaffold, how to deploy (Docker / PM2 / `casen worker start`)
- [ ] New page: `content/docs/packages/zeebe-client.mdx` — `@bpmnkit/zeebe-client` API reference
- [ ] New page: `content/docs/guides/patterns.mdx` — domain pattern library: what patterns are, how to use them, how to contribute new ones
- [ ] Update: `content/docs/cli/` — document `/implement`, `/review`, `/test` skills and `casen skills install`
- [ ] Update: `content/docs/getting-started/` — mention AI-first workflow as the recommended entry point
- [ ] Update `doc/features.md` — add AIKit section listing all new capabilities
- [ ] Update `doc/roadmap.md` — add AIKit phases and check items as they complete
- [ ] Update `doc/progress.md` — changelog entry for each phase as shipped

---

## Worker Lifecycle (Option C)

Scaffolded into the project, runnable anywhere, casen as convenience:

```
project/
  kyc-process.bpmn            ← generated by /implement
  workers/
    document-verify/
      index.ts                ← generated by worker_scaffold()
      package.json            ← standalone, no bpmnkit deps
      Dockerfile              ← for containerized deployment
      README.md               ← env vars, how to run
    risk-score/
      index.ts
      ...

# Run directly
node workers/document-verify/index.js

# Run via Docker
docker run -e TEXTRACT_KEY=... bpmnkit/document-verify

# Run via casen (convenience, not required)
casen worker start document-verify
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Worker runtime dependency | None (plain Node.js) | Workers must run anywhere without BPMNKit installed |
| Zeebe client | Thin in-repo wrapper | Avoids SDK lock-in; both reebe and Camunda 8 support same REST spec |
| Domain knowledge | Static pattern files | Predictable, version-controlled, token-efficient |
| Skill entry point | Claude Code skill (`/implement`) | Composable, portable across projects, works in terminal and IDE |
| BPMN review surface | Studio (existing) | Business users already have it; no new UI needed |
| External API abstraction | Provider-selectable via env | `IDENTITY_PROVIDER=onfido` — swap without code changes |
