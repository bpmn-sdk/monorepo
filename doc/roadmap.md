# Roadmap

Feature roadmap for the BPMN Kit monorepo. Items are ordered by phase within each section.
Check `[x]` when an item is complete.

---

## Builder Experience

> Full proposal and design rationale: [`doc/builder-experience.md`](builder-experience.md)

### Phase 1 — Correctness Foundations

Low effort, high signal. Extend existing infrastructure without new concepts.

**Pattern Advisor** (`packages/plugins/src/pattern-advisor`, `packages/core/src/bpmn/optimize/patterns.ts`)

- [x] Define `PatternFinding` interface and integrate with existing `OptimizationFinding` system
- [x] Implement 15 pattern rules (see `builder-experience.md` §Proposal 3 for the full list):
  - [x] HTTP/REST service task without error boundary
  - [x] Exclusive gateway without default flow
  - [x] Sub-process without error boundary
  - [x] Call activity with no error propagation
  - [x] Parallel branches writing the same variable
  - [x] User task without timer boundary
  - [x] Service task output mapping with no result consumer
  - [x] Error boundary leading directly to end event (catch-and-swallow)
  - [x] Exclusive gateway with only one outgoing flow
  - [x] Undocumented process start variables
  - [x] Timer boundary with duration 0
  - [x] Boundary event with no outgoing flow
  - [x] Empty text annotation
  - [x] Duplicate job type across multiple service tasks
  - [x] FEEL condition using only literal values (never changes at runtime)
- [x] New `pattern-advisor` canvas plugin: persistent side panel with per-element findings
- [x] Canvas badge indicator on affected elements
- [x] [Apply Fix] for auto-fixable patterns; [Dismiss] per element
- [x] Wire `error`-severity patterns into the deploy plugin's optimizer guard

**Chaos Simulation Mode** (`packages/plugins/src/process-runner`)

- [x] Add "Chaos" toggle to the process runner panel
- [x] Implement chaos worker wrapper with configurable failure probability (default 20%)
- [x] Injection types: service failure, null response, random delay
- [x] Post-run summary: "N paths led to stuck instances, M unhandled errors found"
- [x] Export chaos findings as draft test scenarios (Proposal 2 format)

---

### Phase 2 — Static Analysis

Medium effort. New optimize module and canvas overlay plugin.

**Variable Flow Analysis** (`packages/core/src/bpmn/optimize/variable-flow.ts`, `packages/plugins/src/variable-flow`)

- [x] FEEL identifier extractor: walk `@bpmnkit/feel` AST, collect `Name` nodes (excluding built-ins)
- [x] Build variable scope graph: walk `BpmnDefinitions` graph tracking producers/consumers per path
  - [x] IO mapping output targets → variable producers
  - [x] IO mapping input sources → variable consumers (FEEL identifiers)
  - [x] Script task `resultVariable` → variable producer
  - [x] Sequence flow `conditionExpression.text` → variable consumers (FEEL identifiers)
- [x] Implement findings:
  - [x] Variable referenced in condition but never set on that path
  - [x] Variable set but never consumed downstream
  - [x] IO mapping input source references undefined variable
  - [x] Fuzzy-match suggestions for likely typos (Levenshtein distance ≤ 2)
- [x] Integrate with `optimize()` as a new category `"data-flow"`
- [x] Variable flow canvas overlay plugin:
  - [x] Color elements by role: producer / consumer / both
  - [x] Hover element → variable read/write table tooltip
- [x] Hover sequence flow → variables in scope at that edge
- [x] Add variable flow context to AI bridge compact format

**Time-Travel Simulation Debugger** (`packages/plugins/src/process-runner`)

- [x] Record engine event log during simulation (capped at 10,000 events)
- [x] Timeline scrubber UI below the canvas
- [x] State projection at time T: replay events up to T for variables, token positions, FEEL evals
- [x] Variables tab, FEEL tab, and token highlight update to show state at T
- [x] "Replay from here" button

---

### Phase 3 — Test Contracts

Medium effort. Closes the process correctness gap end-to-end.

**Scenario-Based Testing — Process Spec** (`packages/plugins/src/process-runner`, `apps/cli`)

- [x] Define `.bpmn.tests.json` sidecar format (`ProcessScenario` type in `@bpmnkit/engine`)
- [x] Test runner: `@bpmnkit/engine` with per-scenario job worker mocks (`packages/engine/src/scenario.ts`)
- [x] Path assertion: compare `instance.visitedElements` against `expect.path`
- [x] Variable assertion: deep equality on final scope variables against `expect.variables`
- [x] "Tests" tab in the process runner panel:
  - [x] Scenario list with pass/fail badges
  - [x] Run all / run selected buttons
  - [x] Expandable diff on failure: expected vs actual path, variable mismatches highlighted
- [x] Storage plugin integration: auto-discover and open sidecar test file alongside BPMN
- [x] CLI command: `casen test <file.bpmn>` — runs all scenarios, reports pass/fail
- [x] AI integration: "Generate test scenarios" uses compact format → drafts scenario JSON
      covering all gateway branches and error paths
- [x] Integration with Phase 1 chaos: chaos findings exportable as failing test scenarios

---

### Phase 4 — Live Feedback Loop

High effort. Operationally transformative — closes the design/production gap.

**Hot Reload Development — Process Live** (`packages/plugins/src/live-mode`)

- [x] "Live" toggle in editor toolbar; requires proxy connection and a sandbox profile
- [x] Auto-deploy on save: debounced (500ms) `POST /api/v2/deployments` via deploy plugin
- [x] Dev instance lifecycle: start on enable, maintain key across sessions (stored in IndexedDB)
- [x] Auto-migration: `POST /api/v2/process-instances/{key}/migration` on every redeploy
- [x] Migration conflict detection: compare element ID sets; surface mapping UI if instance is
      waiting at a removed element
- [x] Live token overlay: poll active element instances; drive token-highlight canvas API
- [x] Variable inspector: hover element → show live variable values from running instance
- [x] Sandbox guard: Live mode disabled when active profile is tagged as production
- [x] Integration with Phase 3 tests: Live mode only enabled when test suite is green (configurable)

---

### Phase 5 — Collaboration

Medium effort. Expands the builder experience to non-technical stakeholders.

**Story Mode** (`packages/plugins/src/story-view`, `packages/core/src/bpmn/story.ts`)

- [x] View mode toggle in main toolbar: Edit / Story
- [x] Topological sort of `BpmnDefinitions` → CSS flexbox column renderer (Kahn's algorithm, cycle-safe)
- [x] Swimlane layout: derive lanes from pool/lane names; default lane if no laneSet
- [x] Element card renderers:
  - [x] Service task → "System: [name]" card
  - [x] User task → "[Lane/role]: [name]" card with assignee if set
  - [x] Gateway → "Decision" card with outgoing conditions inline
  - [x] All element types mapped to roles with colored left borders
- [x] AI condition summarizer: calls `summarizeCondition` option, caches in-memory per condition
- [x] Read-only shareable link: opens process in story mode with no edit controls
- [x] Comment threads on elements:
  - [x] Stored in IndexedDB keyed by `${fileKey}:${elementId}`
  - [x] Visible in Story mode; comment count badge on card button
  - [x] Resolve/unresolve threads; author display name from active profile

---

## CLI Enhancements

- [x] `casen test <file.bpmn>` — run process spec scenarios (Phase 3)
- [x] `casen lint <file.bpmn>` — run optimizer + pattern advisor + variable flow analysis,
      exit code 1 on errors (CI integration)
- [x] `casen story <file.bpmn>` — render story mode to static HTML for sharing without the editor

---

## Completed

*(Items moved here from above as they ship)*
