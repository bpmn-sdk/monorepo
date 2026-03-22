# Builder Experience — Research & Proposal

> **Goal:** Quickly create a process definition that just *works* — correct on the happy path,
> resilient on error paths, validated before deployment, observable during development.

---

## Diagnosis

The current ecosystem covers design, simulation, AI assistance, and deployment comprehensively.
The remaining gap is the distance between *"the process looks correct"* and *"the process behaves
correctly."* Three root causes account for the majority of production failures:

| Root cause | Symptom | Currently caught? |
|---|---|---|
| **Data bugs** | Variable referenced before it's set; name typo in gateway condition; IO mapping mismatch | ✗ Only at runtime |
| **Incomplete paths** | Missing error boundary on HTTP call; exclusive gateway with no default flow; user task with no timeout | ~ Partial (optimizer checks structure, not runtime impact) |
| **Slow feedback loop** | Design → deploy → start instance → observe takes minutes; issues found one at a time | ~ Manual (simulation exists but has no test contracts) |

---

## Proposal 1 — Variable Flow Analysis ("Process TypeChecker")

### What it is

Static analysis that walks every path through the process graph and tracks which variables are
provably in scope at each point. Cross-references gateway conditions, IO mapping sources/targets,
and script task result variables. Surfaces mismatches and undefined references as optimizer
findings — before any execution.

### Why it matters

The engine tracks variables at runtime via a hierarchical scope store, but there is no static
phase that maps variable access across the model. A task can output `customerId` and the very next
gateway condition can reference `customer_id`; nothing catches this until the instance reaches that
gateway in production.

This is the BPMN equivalent of TypeScript's type checker applied to process data flow.

### Example findings

```
[Gateway: Premium?]
  condition: = customer_id = "premium"
  ✗ Variable "customer_id" is never set on this path.
    "customerId" was set in task "Extract Customer" — did you mean that?

[Task: Send Confirmation]
  IO output: result → confirmationId
  ⚠ "confirmationId" is set here but never read by any downstream element.

[Parallel join]
  Both branches write to "status"
  ⚠ Last writer wins — result is non-deterministic depending on execution order.
```

### How it works

- New optimize module: `packages/core/src/bpmn/optimize/variable-flow.ts`
- Topological walk of `BpmnDefinitions` graph (not execution); collects:
  - `ZeebeIoMapping` input targets (variables written at task entry)
  - `ZeebeIoMapping` output targets (variables written at task exit)
  - `resultVariable` on script/business-rule tasks
  - FEEL identifier references extracted from `conditionExpression.text` and IO mapping source expressions
- Returns `OptimizationFinding[]` consistent with the existing optimizer contract — plugs in immediately
- New canvas overlay plugin `packages/plugins/src/variable-flow/`:
  - Elements colored by role: **producer** (sets variables), **consumer** (reads variables), **both**
  - Hover an element → show variable read/write table
  - Hover a sequence flow → show which variables are in scope at that edge
- AI bridge integration: variable flow graph added to compact context so the AI can answer
  "why does this condition fail?" with knowledge of what's actually in scope

### Key technical detail

FEEL identifier extraction from arbitrary expressions requires parsing them — the `@bpmnkit/feel`
package already has a full parser. Walk the AST, collect `Name` nodes that are not built-in
functions. This gives a conservative set of variable references per expression.

---

## Proposal 2 — Scenario-Based Testing ("Process Spec")

### What it is

Test cases as first-class citizens in the editor. Each scenario specifies: input variables,
per-job-type mock responses, expected execution path, and expected output variables. Run all
scenarios → red/green report with diff on failure.

### Why it matters

Currently simulation is manual and ephemeral. There is no concept of a repeatable, committed test
for a process. This means every process ships without a test suite, and "does it work" is answered
in production rather than at design time.

Process Spec enables TDD for BPMN: write the scenarios first (happy path, payment failure, timeout
breach, invalid input), design the process to pass them, ship with a green test suite.

### Scenario format

```json
[
  {
    "name": "Happy path — order approved",
    "input": { "orderId": "ORD-123", "amount": 450 },
    "mocks": {
      "io.camunda.connector.HttpJson:1": { "approved": true, "limit": 500 }
    },
    "expect": {
      "path": ["StartEvent_1", "Task_ValidateOrder", "Gateway_Approved", "Task_SendConfirmation", "EndEvent_1"],
      "variables": { "approved": true, "notificationSent": true }
    }
  },
  {
    "name": "Payment rejected — amount over limit",
    "input": { "orderId": "ORD-124", "amount": 9999 },
    "mocks": {
      "io.camunda.connector.HttpJson:1": { "approved": false, "reason": "exceeds limit" }
    },
    "expect": {
      "path": ["StartEvent_1", "Task_ValidateOrder", "Gateway_Approved", "Task_NotifyRejection", "EndEvent_Rejected"],
      "variables": { "approved": false }
    }
  }
]
```

### How it works

- Test spec stored as a sidecar `.bpmn.tests.json` alongside the BPMN file; auto-discovered and
  opened in the storage/tabs system
- Test runner uses `@bpmnkit/engine` with scenario-defined job worker mocks:
  - Job workers registered per job type using scenario `mocks` object
  - Each worker returns the mocked variables and completes immediately
- Assertions:
  - **Path**: compare `instance.visitedElements` (set of element IDs) against `expect.path`
  - **Variables**: deep equality on final process scope variables against `expect.variables`
- UI: new "Tests" tab in the process runner panel — list of scenarios, run button, pass/fail badges,
  expandable diff on failure showing expected vs actual path and variable mismatches
- CLI: `casen test <file.bpmn>` runs all scenarios, outputs JUnit XML for CI pipeline integration
- AI integration: "Generate test scenarios for this process" prompt uses the compact format + AI
  to draft scenario JSON that covers all gateway branches and error paths; user reviews and saves

---

## Proposal 3 — Pattern-Based Proactive Advisor ("Process Copilot")

### What it is

A persistent "Suggestions" panel that auto-updates as you edit. Not chat-driven — the editor
watches for known incomplete patterns and surfaces targeted, one-click-fixable suggestions.

### Why it matters

The AI bridge is reactive (you ask it things). The optimizer runs on demand. But 80% of process
reliability issues follow a small, detectable set of patterns. They should appear as you design,
not at review time.

This is ESLint for process design: rules that encode production failure patterns, running
continuously in the background.

### The pattern library (top 15)

| Pattern | Severity | Why it fails in production |
|---|---|---|
| HTTP/REST service task without error boundary | Error | Network failure leaves instance stuck indefinitely |
| Exclusive gateway without default flow | Error | No matching condition → instance gets stuck |
| Sub-process without error boundary | Error | Any unhandled error terminates the sub-process silently |
| Call activity with no error propagation | Error | Child process error not caught by parent |
| Parallel branches both writing the same variable | Error | Non-deterministic — last writer wins |
| User task without timer boundary | Warning | No SLA enforcement; task waits forever |
| Service task with output mapping but no result variable | Warning | Result is computed but immediately discarded |
| Error boundary catch leading directly to end event | Warning | Catch-and-swallow; error silently consumed |
| Exclusive gateway with only one outgoing flow | Warning | Gateway is effectively a pass-through; remove it |
| Process start with no documented input variables | Warning | Service/caller has no contract to fulfill |
| Empty annotation on element | Info | Annotation placeholder was never filled in |
| Duplicate job type across multiple service tasks | Info | May conflict with the same worker; verify intent |
| FEEL condition referencing a literal instead of a variable | Info | Hard-coded condition will never change at runtime |
| Timer boundary with duration 0 | Error | Fires immediately; almost certainly unintentional |
| Boundary event with no outgoing flow | Error | Token has nowhere to go; instance deadlocks |

### How it works

- Extend the optimize module: new rules in `packages/core/src/bpmn/optimize/patterns.ts`,
  each following the existing `OptimizationFinding` interface with `applyFix` callbacks
- New plugin `packages/plugins/src/pattern-advisor/`:
  - Hooks into `element:changed` canvas events to recheck patterns for modified elements only
  - Side panel renders findings grouped by element, with severity badges
  - Each finding has: what's wrong, one sentence on why it fails in production, [Apply Fix] button,
    [Learn more] expandable with a mini example, [Dismiss] to suppress per element
  - Finding badge on canvas element (small indicator at element edge)
- Severity mapping: `error` patterns block the deploy plugin (added to the optimizer guard);
  `warning` and `info` shown in panel only

---

## Proposal 4 — Hot Reload Development ("Process Live")

### What it is

A "Live" toggle in the editor toolbar. Every save auto-deploys to the configured Camunda sandbox.
A persistent "dev instance" migrates to the new version automatically. Token positions from the
live instance appear on the editor canvas in real time.

### Why it matters

The design → deploy → start instance → observe cycle currently takes minutes per iteration.
Issues are discovered one at a time, serially, in real Camunda. The feedback loop is fundamentally
broken for rapid iteration.

This is Vite HMR for BPMN processes: see the effect of your design changes on a running instance
in seconds, without leaving the editor.

### The experience

1. Enable "Live" mode in the editor toolbar
2. Every save auto-deploys (debounced ~500ms) to the proxy-connected Camunda cluster
3. A "dev instance" is maintained — when the process is redeployed, the instance auto-migrates to
   the new version using Camunda's process instance migration API
4. Token positions from the live instance appear on the editor canvas via SSE (same amber/green
   highlighting as the token-highlight plugin, but sourced from real Camunda)
5. Hovering an element shows the actual variable values the live instance holds at that point
6. If migration fails (incompatible change), a visual diff shows the mapping conflict and presents
   manual mapping options

### How it works

- Auto-deploy: debounced call to the existing deploy plugin's deployment logic on every
  `diagram:save` event
- Instance migration: `POST /api/v2/process-instances/{key}/migration` (Camunda 8 REST API)
- Live token state: the proxy/operate SSE infrastructure already streams instance state events;
  new "live-mode" plugin `packages/plugins/src/live-mode/` consumes them and drives the existing
  token-highlight canvas API
- Migration conflict detection: compare element IDs in current vs previous version; if the instance
  is waiting at a removed/renamed element, surface a migration mapping UI
- Scoped to sandbox: Live mode is explicitly tied to a "sandbox" profile to prevent accidental
  hot-reloads against production clusters

---

## Proposal 5 — Story Mode ("Process as Narrative")

### What it is

A second view mode in the editor — **Edit** (current BPMN canvas) vs **Story** (process rendered
as a card-based, swimlane narrative that requires no BPMN knowledge to read).

### Why it matters

BPMN processes are designed by developers but reviewed and owned by business analysts, product
owners, and operations teams. Currently there is no view that bridges the technical diagram and
business intent. Review cycles happen outside the tool — in emails, Confluence pages, meetings.
Story mode brings reviewers into the editor.

### What story mode looks like

```
┌─────────────────────────────────────────────────────────────┐
│  Order Approval Process                                      │
│                                                              │
│  SYSTEM                    FINANCE TEAM       CUSTOMER       │
│  ─────────────────         ─────────────────  ────────────   │
│  ┌─────────────────┐                                         │
│  │ Validate Order  │                                         │
│  │ (calls Payment  │                                         │
│  │  API)           │                                         │
│  └────────┬────────┘                                         │
│           │                                                   │
│     If approved (amount ≤ limit)                             │
│           │                                                   │
│           │               ┌──────────────────┐               │
│           └──────────────▶│  Send Approval   │               │
│                           │  Notification    │               │
│                           └──────────────────┘               │
│     If rejected                                              │
│           │                                                   │
│           │                                ┌───────────────┐  │
│           └──────────────────────────────▶│ Notify        │  │
│                                           │ Rejection     │  │
│                                           └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- Gateway conditions shown as plain-English "If / If not" labels (AI-generated, cached)
- Service tasks shown as "System: [what it does]"
- User tasks shown as the assigned role/group performing an action
- Error paths shown in red with a plain-language description of the failure
- Swimlanes derived from pool/lane names or grouped by job type namespace

### How it works

- New plugin `packages/plugins/src/story-view/`
- Reads `BpmnDefinitions` — no separate artifact; Story is always a live render of the same model
- Topological sort → CSS flexbox column per lane
- Condition summaries: one-time AI fetch per unique condition string (e.g. `= amount <= 500`),
  cached in IndexedDB; shown as "If amount is 500 or less"
- View toggle in main toolbar; story view replaces the canvas in the same container
- Read-only shareable link: opens the process in story mode with no edit controls

---

## Proposal 6 — Simulation Chaos Mode (Unconventional)

### What it is

A "Chaos" checkbox in the process runner. When enabled, the simulation engine randomly injects
failures during execution to expose brittle paths.

### Why it matters

Chaos engineering shows that infrastructure only fails in production because it was never tested
under failure conditions. The same is true for processes. A process that can't survive a random
service failure in simulation will not survive it in production.

### What it injects

| Injection | Effect exposed |
|---|---|
| Random service task failure (throws error) | Missing error boundaries become visible |
| Random service task timeout (timer fires) | Missing timer boundaries become visible |
| Null return from job worker | Missing null guards in downstream FEEL conditions |
| Random delay on parallel branches | Non-deterministic variable writes between branches |
| Random user task reassignment | Hardcoded assignee assumptions surface |

After a chaos run: "3 paths led to stuck instances, 1 path surfaced an unhandled error" →
these findings are offered as instant test case candidates for Proposal 2.

### How it works

- Checkbox in the process runner panel; seeds a random chaos schedule before each run
- Chaos worker wrapper: wraps registered job workers with a configurable failure probability
  (default: 20% per task); chooses randomly from injection types per element type
- Integration with Proposal 2: chaos findings can be exported as failing test scenarios,
  turning discovered gaps into a regression test suite

---

## Proposal 7 — Time-Travel Simulation Debugger (Unconventional)

### What it is

Record the full execution event log during simulation. Add a timeline scrubber below the canvas.
Drag backwards → canvas token positions, variable values, and FEEL evaluations all replay to that
exact moment.

### Why it matters

Currently: if a gateway condition evaluates unexpectedly, you re-run the simulation and watch more
carefully. With time travel: scrub back to exactly that moment, look at the variable state panel
and the FEEL evaluation tab for that instant. "Why was this condition false?" becomes answerable
in seconds.

This is Redux DevTools for BPMN execution.

### How it works

- The engine already emits a typed event stream for everything: `variable:set`, `element:entered`,
  `element:leaving`, `feel:evaluated`
- Record all events in an array during simulation (capped at ~10,000 events ≈ ~1MB)
- Timeline scrubber UI below the canvas: shows element names at key waypoints
- Scrubber position sets a "view time T"; process-runner computes projected state at T by
  replaying events up to that timestamp
- Variables tab, FEEL tab, and token highlight all update to show state at T
- "Replay from here" button: re-runs simulation from the selected checkpoint forward

---

## Priority and Dependencies

```
Phase 1 — Correctness foundations (low effort, high signal)
  ├── Proposal 3: Pattern Advisor           [extends existing optimize module]
  └── Proposal 6: Chaos Mode               [extends existing process runner]

Phase 2 — Static analysis (medium effort, highest long-term impact)
  ├── Proposal 1: Variable Flow Analysis   [new optimize module + canvas overlay]
  └── Proposal 7: Time-Travel Debugger     [extends existing process runner]

Phase 3 — Test contracts (medium effort, closes the correctness gap)
  └── Proposal 2: Scenario Testing         [new engine harness + UI tab + CLI command]
      └── depends on: Proposal 1 (variable names are typed; tests reference them)

Phase 4 — Live feedback loop (high effort, operationally transformative)
  └── Proposal 4: Hot Reload Development   [new live-mode plugin + migration API]
      └── depends on: Proposal 2 (confidence to hot-reload requires a passing test suite)

Phase 5 — Collaboration (medium effort, expands audience)
  └── Proposal 5: Story Mode               [new view plugin + AI condition summaries]
```

### Impact vs effort summary

| # | Proposal | Impact | Effort | Phase |
|---|---|---|---|---|
| 3 | Pattern Advisor | High | Low | 1 |
| 6 | Chaos Mode | Medium | Low | 1 |
| 1 | Variable Flow Analysis | Very High | Medium | 2 |
| 7 | Time-Travel Debugger | Medium | Low | 2 |
| 2 | Scenario Testing | Very High | Medium | 3 |
| 4 | Hot Reload Development | High | High | 4 |
| 5 | Story Mode | Medium | Medium | 5 |

---

## Cross-cutting principles

**Move correctness feedback left.** Every proposal shifts a class of error from being discovered
in production (or even in Camunda) to being discovered in the editor, at design time.

**Extend, don't replace.** Every proposal builds on existing infrastructure:
- Proposals 1 and 3 extend the `OptimizationFinding` system already wired into the editor and
  the deploy guard
- Proposals 2 and 7 extend `@bpmnkit/engine` and the process runner plugin
- Proposal 4 extends the deploy plugin and the token-highlight + operate SSE infrastructure
- Proposal 6 wraps the existing process runner job worker mock system

**No new tools.** The user should not have to learn anything new. Pattern findings appear inline
with today's optimizer findings. Test scenarios appear in the existing process runner panel.
Live mode is a toggle. Story mode is a view toggle. All within the existing editor.
