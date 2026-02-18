# Plan

**Timestamp:** 2026-02-18T15:11:04.409Z

## Original Request

This is a greenfield project to create an SDK to programmatically create BPMN workflows with typescript.
Tech Stack: nodejs, typescript, esm, turborepo, pnpm, biome, vitest. Use only the latest versions of all dependencies. Only use dependencies if not possible differently. If possible try to implement everything within the sdk (less dependencies is better). All dev dependencies must be added to the root package.json.
Non-functional requirements: fully types, awesome documentation, self-explanatory functions
Features:
- exports to bpmn xml
- supports camunda flavor
- automatically positions the elements in a proper way
  - enough space to not conflict with other elements on the canvas
  - branching and merging is well positioned
- supports rest connector and feel language in script tasks by camunda
Analyze and study this java implementation to get familiar with it: https://github.com/camunda/camunda/tree/main/zeebe/bpmn-model
Study this PR to understand how n8n build the sdk and use best practices from it: https://github.com/n8n-io/n8n/pull/24535
Study the bpmn and form files in folder "examples" to understand and get familiar with the structure.

Make sure to write reasonable tests, and add commands on root level for build, typecheck, lint, format, and one command for all of these combined: verify.

Study the most popular SDKs out there and design the SDK according to best and common practices.

## Refined Requirements

Now I have the confirmed count (9 branches). Here is the complete revised section:

---

## Problem Statement
Build a TypeScript SDK (`@urbanisierung/bpmn-sdk`) for programmatically creating, parsing, and exporting BPMN workflows, DMN decision tables, and Camunda Forms — targeting Camunda Cloud (Zeebe) flavor. The SDK should provide a fluent, fully-typed builder API inspired by the Camunda Java SDK, with automatic element positioning/layout.

---

## Acceptance Criteria

### Core SDK
- [ ] Fluent builder API to construct BPMN processes (e.g., `Bpmn.createProcess("id").startEvent().serviceTask(...).endEvent().build()`)
- [ ] Parse/import existing BPMN XML into the internal model
- [ ] Export internal model to valid BPMN 2.0 XML (compatible with Camunda Modeler)
- [ ] Full TypeScript types — all builder methods are type-safe; see "Typing Strategy for Dynamic XML Content" below for how unknown/dynamic structures are typed

### Roundtrip Fidelity
- [ ] Roundtrip is **semantically equivalent**, not byte-identical. Specifically:
  - Element IDs, names, types, attributes, and relationships must be preserved exactly
  - Zeebe extension elements and attributes must be preserved exactly
  - Unknown/custom extension elements (not modeled by the SDK) must be preserved as opaque `XmlElement` nodes and re-serialized on export
  - Attribute ordering and insignificant whitespace may differ between input and output
  - XML comments are **not** preserved
  - Namespace prefixes may be normalized (e.g., `bpmn2:` → `bpmn:`) but namespace URIs must be preserved
- [ ] BPMN roundtrip validation: for every `.bpmn` example file, `export(parse(file))` must produce XML that Camunda Modeler opens without errors and has identical semantic content. This criterion applies only to BPMN XML files — DMN and Form roundtrip criteria are stated separately in their respective sections

### BPMN Element Support

**Validated by examples (roundtrip-tested against example files):**
- [ ] Start events (none, timer — see `Regular Phase check.bpmn`, `Handle PDP - New Epic.bpmn`)
- [ ] End events
- [ ] Service tasks (with Zeebe task definition, IO mapping, task headers)
- [ ] Script tasks (with `zeebe:script` and FEEL expressions)
- [ ] User tasks (with form references)
- [ ] Call activities (`zeebe:calledElement` with `processId`, `propagateAllChildVariables`)
- [ ] Exclusive gateways (including fan-out with 9 branches and fan-in merge — see `Handle PDP - Comment.bpmn`)
- [ ] Parallel gateways (fork and join — see `Handle PDP - New Epic.bpmn`, `Update Progress.bpmn`)
- [ ] Sequence flows with FEEL condition expressions
- [ ] Intermediate catch events: timer (`timeDefinition` with `timeDuration` — see `Handle PDP - New Epic.bpmn`, `Regular Phase check.bpmn`)
- [ ] Intermediate throw events: none/plain (no event definition — see `Epic Review Bot.bpmn`)
- [ ] Error boundary events (`errorEventDefinition` — see `Epic Review Bot.bpmn`, `Fetch Project Data.bpmn`, `Regular Phase check.bpmn`)
- [ ] Ad-hoc sub-processes with multi-instance loop characteristics (see `Epic Review Bot.bpmn` — `bpmn:adHocSubProcess` with `zeebe:adHoc`, `bpmn:multiInstanceLoopCharacteristics`, `zeebe:loopCharacteristics`)

**Aspirational (no example files; builder support without roundtrip tests):**
- [ ] Inclusive gateways
- [ ] Event-based gateways
- [ ] Embedded sub-processes (`bpmn:subProcess`) — single-level only; nested sub-processes (sub-process inside another sub-process) are out of scope
- [ ] Event sub-processes
- [ ] Message start events
- [ ] Intermediate catch events: message, signal
- [ ] Intermediate throw events: message, signal, escalation
- [ ] Timer boundary events
- [ ] Message boundary events
- [ ] Signal boundary events

These aspirational elements are supported in the builder API and XML export, but are not validated by roundtrip tests until example files are added.

### Fluent Builder API for Branching Workflows

The builder must support non-linear (branching/merging) workflows. The API design:

- **Branching from a gateway**: `gateway.branch(branchName, builder => { ... })` — each branch receives its own sub-builder for chaining elements along that path. The gateway creates named branches, each with an optional condition expression.
- **Merging back**: `branch.connectTo(elementId)` — connects the current branch endpoint to a previously-created element by ID, enabling fan-in merging to a gateway or any other element. `connectTo` supports both forward references (connecting to an element later in the flow) and **backward references** (connecting to an element earlier in the flow, creating a loop).
- **Referencing existing elements**: `process.element(elementId)` — returns a builder positioned at the specified element, allowing additional outgoing flows from any point in the graph.
- **Multiple start/end events**: The builder supports multiple start and end events via `process.element(elementId)` to position the builder at any point, then chain a new `startEvent()` or `endEvent()` from there. Example:
  ```ts
  Bpmn.createProcess("multi-start")
    .startEvent("start1")
    .serviceTask("task1", { taskType: "handle" })
    .endEvent("end1")
    .addStartEvent("start2")  // adds a disconnected start event
    .serviceTask("task2", { taskType: "other" })
    .connectTo("end1")        // merge into existing end event
    .build();
  ```
- **Example pattern (branching/merging):**
  ```ts
  Bpmn.createProcess("order-process")
    .startEvent("start")
    .exclusiveGateway("check-amount")
    .branch("high-value", b => b
      .condition("= amount > 1000")
      .serviceTask("approval", { taskType: "approve-order" })
      .connectTo("merge")
    )
    .branch("low-value", b => b
      .defaultFlow()
      .serviceTask("auto-approve", { taskType: "auto-approve" })
      .connectTo("merge")
    )
    .exclusiveGateway("merge")
    .endEvent("end")
    .build();
  ```
- **Parallel branching** follows the same pattern using `parallelGateway(id)` instead of `exclusiveGateway(id)`.

### Camunda Cloud Extensions
- [ ] `zeebe:taskDefinition` (type, retries)
- [ ] `zeebe:ioMapping` (input/output mappings with FEEL expressions)
- [ ] `zeebe:taskHeaders` — key-value header pairs (`<zeebe:header key="..." value="..." />`), commonly used for `resultVariable`, `resultExpression`, `retryBackoff`, `elementTemplateId`, etc.
- [ ] `zeebe:properties` (webhook config, connector properties)
- [ ] `zeebe:script` (FEEL expression, resultVariable)
- [ ] `zeebe:calledElement` (processId, propagateAllChildVariables)
- [ ] `zeebe:formDefinition`
- [ ] `zeebe:versionTag`
- [ ] `zeebe:adHoc` (activeElementsCollection)
- [ ] `zeebe:loopCharacteristics` (inputCollection, inputElement, outputCollection, outputElement)
- [ ] Modeler template metadata (`zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, `zeebe:modelerTemplateIcon`)
- [ ] REST connector convenience builder — a dedicated builder method (e.g., `.restConnector({ method: "POST", url: "...", authentication: { token: "..." }, headers: {...}, queryParams: {...}, body: "..." })`) that generates the underlying `zeebe:taskDefinition` (type `io.camunda:http-json:1`) and `zeebe:ioMapping` inputs. This is syntactic sugar over existing primitives; the same result can be achieved manually via service task + IO mappings

### Auto-Layout
- [ ] Automatic element positioning (x, y coordinates) in `bpmndi:BPMNDiagram`
- [ ] **Standard element sizes**: events 36×36, tasks 100×80, gateways 50×50, sub-processes sized to fit content with 20px padding (applies to both ad-hoc sub-processes and aspirational embedded sub-processes; internal elements are laid out via a nested layout pass in local coordinates, then the sub-process bounds are computed and translated into the parent coordinate space)
- [ ] **Minimum spacing**: 80px horizontal gap between elements, 60px vertical gap between parallel branches
- [ ] **Overlap validation**: no two element bounding boxes may overlap, no element bounding box may overlap with any label bounding box, and no two label bounding boxes may overlap. Sequence flow edge crossings over elements are minimized by the layout algorithm but are not treated as assertion failures (some crossings are unavoidable in complex graphs). The layout engine must assert the overlap constraints as a post-condition
- [ ] Branching (gateway → multiple paths) and merging (paths → gateway) are positioned using a layered/Sugiyama-style algorithm: branches stack vertically, gateway centered on its branches. **Cycle handling**: back-edges (loops) are detected via DFS, temporarily reversed for layer assignment, then restored with correct waypoint routing after positioning
- [ ] Edge routing: all sequence flow edges must use strictly orthogonal (horizontal and vertical) segments
- [ ] Label positioning: labels centered below events, centered inside tasks, centered above gateway diamonds, centered above the midpoint waypoint of sequence flows offset by 10px vertically

### DMN Support
- [ ] Create DMN decision tables programmatically
- [ ] Parse/import existing DMN XML
- [ ] Export to DMN XML
- [ ] **Input columns**: label, `inputExpression` with `typeRef` (supported types: `string`, `boolean`, `number`, `date`), expression text
- [ ] **Output columns**: label, name, `typeRef`
- [ ] **Rules**: input entries (unary tests), output entries (literal expressions), rule `description` (annotation text)
- [ ] **Multi-output tables**: support tables with 2+ output columns (validated by `Github>Slack users.dmn` which has 2 outputs)
- [ ] **Hit policies**: UNIQUE (default), FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY. Only UNIQUE is validated by examples; others are builder-supported
- [ ] DMN roundtrip: for every `.dmn` example file, `export(parse(dmn))` must produce semantically equivalent DMN XML

### Form Support
- [ ] Create Camunda Forms (JSON format) programmatically
- [ ] Parse/import existing form JSON
- [ ] Export to form JSON
- [ ] **Leaf component types**: `text`, `textfield`, `textarea`, `select`, `radio`, `checkbox`, `checklist`
- [ ] **Container component type**: `group` — a container that holds a recursive `components` array. The form model must be a recursive tree structure where groups can nest arbitrarily deep (validated by examples: groups contain checkboxes, radios, checklists, textareas)
- [ ] **Validation rules**: `required` (boolean), `minLength`, `maxLength`
- [ ] **Layout**: `showOutline` on groups
- [ ] **Default values** and **dynamic values** (`valuesKey` for external value sources)
- [ ] **Searchable selects**: `searchable: true` on select components
- [ ] Form roundtrip: for every `.form` example file, `export(parse(form))` must produce semantically equivalent JSON

### Infrastructure
- [ ] Turborepo monorepo with `packages/bpmn-sdk` as initial package
- [ ] pnpm workspaces
- [ ] ESM-only (`"type": "module"`)
- [ ] Biome for linting/formatting
- [ ] Vitest for testing
- [ ] Changesets for versioning — **local tooling only**: `@changesets/cli` configured with `changeset` and `changeset version` commands, `.changeset/config.json` with npm access set to `public`. No CI/CD pipeline or GitHub Actions for automated publishing; publishing is done manually via `changeset publish`
- [ ] Root-level commands: `build`, `typecheck`, `lint`, `format`, `test`, `verify` (runs all)
- [ ] All devDependencies in root `package.json`

### Non-Functional
- [ ] Fully typed — zero `any` in SDK source code, strict TypeScript (see "Typing Strategy" below)
- [ ] Self-explanatory function names (no abbreviations, intuitive API)
- [ ] Comprehensive JSDoc documentation on all public APIs
- [ ] Latest versions of all dependencies

---

## Technical Requirements
- **Runtime**: Node.js (latest LTS), ESM
- **Language**: TypeScript strict mode
- **Build**: Turborepo pipelines
- **Package**: `@urbanisierung/bpmn-sdk` on npm
- **XML**: Use `fast-xml-parser` for XML parsing/serialization. Decision criterion: it handles namespace prefixes, CDATA, and attribute preservation. If during implementation it fails to correctly handle BPMN's 6+ namespace prefixes (`bpmn:`, `bpmndi:`, `dc:`, `di:`, `zeebe:`, `modeler:`) or `xsi:type` attributes, fall back to implementing a custom XML serializer/parser on top of `saxes` (a modern, spec-compliant SAX parser). Do not use more than one XML library.
- **API Pattern**: Fluent builder with method chaining (inspired by Camunda Java SDK's `AbstractFlowNodeBuilder`), with explicit branching/merging API as specified in "Fluent Builder API for Branching Workflows" above
- **Layout Algorithm**: Graph-based auto-layout (Sugiyama/layered) implemented in-SDK — no external layout library

### Typing Strategy for Dynamic XML Content
- Known BPMN/Zeebe/DMN elements are modeled as fully typed interfaces (zero `any`)
- Unknown/custom extension elements encountered during XML parsing are represented as `XmlElement`:
  ```ts
  interface XmlElement {
    name: string;                           // qualified element name, e.g. "custom:myExtension"
    attributes: Record<string, string>;     // attribute keys stored with namespace prefix (e.g. "xsi:type", "zeebe:modelerTemplate"), never resolved/expanded
    children: XmlElement[];                 // nested child elements
    text?: string;                          // text content, if any
  }
  ```
- Attribute keys in `XmlElement.attributes` retain their namespace prefix exactly as it appears in the source XML (e.g., `"xsi:type"` → `"bpmn:tFormalExpression"`). Namespace URIs are not stored per-attribute; they are resolved via the document-level namespace declarations during serialization. This ensures roundtrip fidelity without duplicating namespace resolution logic.
- Each modeled BPMN element type carries an optional `extensionElements: XmlElement[]` array for unrecognized extensions
- `Record<string, unknown>` is permitted in XML parsing internals where raw parsed data is validated and narrowed before entering the typed model
- `any` is prohibited everywhere — use `unknown` with type narrowing instead

---

## Edge Cases
- Circular references in gateways (loops) — the builder supports backward references via `connectTo(elementId)` where the target element appears earlier in the flow; the layout engine handles cycles via back-edge detection and temporary edge reversal (see Auto-Layout)
- Empty processes (no elements)
- Multiple start/end events — supported in both parsing and building (see builder API section for the `addStartEvent` pattern)
- Large workflows (100+ elements) — layout must scale without overlap violations
- BPMN XML with unknown/custom extensions — preserve on roundtrip as opaque `XmlElement` nodes
- Fan-out gateways with many branches (validated by `Handle PDP - Comment.bpmn` which has a gateway with 9 outgoing flows)
- Ad-hoc sub-processes with multi-instance loops (validated by `Epic Review Bot.bpmn`)

---

## Out of Scope
- Visual rendering / UI components
- BPMN execution engine
- Camunda Platform 7 (classic) support — Zeebe/Cloud only
- CMMN support
- BPMN collaboration diagrams (pools/lanes) — can be added later
- Real-time collaborative editing
- **Zeebe Element Templates** (`.json` connector template files like `GLEAN Search API PM - BALAZS.json` and `Notify Slack Channel.json`): the SDK does not parse, create, or export Element Template JSON files. The SDK _does_ support the modeler template metadata attributes (`zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, `zeebe:modelerTemplateIcon`) on BPMN elements that reference these templates
- CI/CD pipelines for automated npm publishing (Changesets is local tooling only)
- Nested sub-processes (sub-process inside another sub-process); single-level embedded sub-processes are aspirational (builder-only, no roundtrip tests)
- BPMN structural validation (e.g., dangling flows, unconnected elements) — may be added as a future enhancement
- Secret reference helpers — `{{secrets.NAME}}` strings are passed through as-is in `zeebe:input` source attributes with no special SDK handling; they are plain string content, not a distinct feature
- **Conditional visibility in forms** — deferred until example files demonstrating condition structures are available; will be specified and added to aspirational scope at that time

---

## Documentation Deliverables
- `README.md` — intro, quickstart, installation
- `doc/progress.md` — changelog
- `doc/features.md` — feature list
- `doc/documentation.md` — detailed API usage
- `doc/roadmap.md` — implementation roadmap

## Engineering Decisions

**

The requirements are exceptionally well-specified. Here is my summary of technical decisions and assumptions:

### Key Assumptions
1. **`camunda:` namespace** (Platform 7, present in example files) — treated as opaque `XmlElement` and passed through on roundtrip, since the SDK targets Zeebe/Cloud only.
2. **Form `layout` property** (`row`, `columns`) — present in example forms but not explicitly called out in requirements. Will be preserved on roundtrip as part of the JSON model; builder support for grid layout positioning is not required.
3. **Form metadata** (`executionPlatform`, `executionPlatformVersion`, `exporter`, `schemaVersion`) — preserved on roundtrip; builder sets sensible defaults.
4. **Internal model design** — I have freedom to design the internal BPMN/DMN model interfaces; only the public builder API shape and `XmlElement` type are specified.
5. **Parse error handling** — malformed XML/JSON throws descriptive errors (fail fast per coding guidelines); no partial-result mode.

### Implementation Approach
- **XML library**: Start with `fast-xml-parser`; fall back to `saxes` only if namespace handling fails (as specified).
- **Layout**: Custom Sugiyama/layered algorithm, no external library. Back-edges detected via DFS, temporarily reversed for layering, restored for routing.
- **Builder pattern**: Immutable-style method chaining where each method returns the builder. Gateway branching via `branch(name, callback)` with sub-builders. `connectTo()` for merging/loops.
- **Roundtrip strategy**: Parse into typed model + `XmlElement[]` for unknowns → serialize back. Semantic equivalence validated by re-parsing exported XML and comparing model structures.
- **Testing**: Vitest roundtrip tests for every example file (BPMN, DMN, Form). Builder tests for all element types including aspirational ones.

### Confirmed Scope Boundaries
- 9-branch exclusive gateway validated by `Handle PDP - Comment.bpmn` (all targets are call activities)
- Ad-hoc sub-process with multi-instance loop validated by `Epic Review Bot.bpmn`
- 2 plain intermediate throw events in `Epic Review Bot.bpmn`
- 8 namespace prefixes in examples (`bpmn`, `bpmndi`, `dc`, `di`, `zeebe`, `modeler`, `xsi`, `camunda`)
- No `bpmn:subProcess` in any example file (embedded sub-processes are aspirational only)
- All 8 form component types in examples match the spec exactly; no `conditional` fields present

Ready to plan and implement on your signal.

## Design Decisions

**

The requirements are exceptionally detailed and leave no significant ambiguity from a developer experience / API design perspective. Here is my summary of the design decisions and assumptions:

### API Surface (Developer Experience)
- **Fluent builder** with method chaining is the primary creation API. The branching model (`gateway.branch(name, builder => {...})` + `connectTo(id)`) is well-specified with concrete examples covering fan-out, fan-in, parallel, and loop patterns.
- **Three entry points**: `Bpmn.createProcess()`, `Dmn.createDecisionTable()`, and `Form.create()` — each with `parse()` / `export()` counterparts for roundtrip.
- **REST connector convenience builder** is syntactic sugar — no new primitives, just ergonomic shortcuts.

### Roundtrip Contract
- Semantic equivalence, not byte-identical. Attribute ordering, whitespace, comments, and namespace prefix normalization are explicitly allowed to differ. Unknown extensions are preserved as opaque `XmlElement` nodes — this is the escape hatch for forward compatibility.

### Auto-Layout Constraints
- Fixed element sizes (events 36×36, tasks 100×80, gateways 50×50), minimum spacing (80px H, 60px V), orthogonal edge routing, Sugiyama-style layering with cycle handling via back-edge reversal. Sub-processes get nested layout passes. Overlap is a hard assertion; edge crossings are best-effort.

### Scope Boundaries
- Validated elements have roundtrip tests against the 35 example files. Aspirational elements (inclusive gateways, event sub-processes, message events, etc.) get builder + export support only — no roundtrip tests until examples are added.
- Pools/lanes, CMMN, Zeebe Element Template files, nested sub-processes, and structural validation are explicitly out of scope.

### Key Assumptions Confirmed
- `fast-xml-parser` is the starting point for XML; `saxes` is the fallback.
- 9-branch fan-out gateway confirmed in `Handle PDP - Comment.bpmn`.
- Multi-output DMN validated by `Github>Slack users.dmn` (2 outputs).
- Recursive form groups validated by `Transition form > Define to Implement.form`.
- Ad-hoc sub-processes with multi-instance loops validated by `Epic Review Bot.bpmn`.

No further clarification needed — ready for implementation planning.

## Technical Analysis

## Technical Feasibility Assessment Summary

### Complexity: **HIGH**

Three main drivers: (1) BPMN 2.0 XML with 9+ namespaces and roundtrip fidelity across 30 example files, (2) a Sugiyama-style auto-layout engine implemented from scratch (~2500 LoC), and (3) three distinct format domains (BPMN/DMN/Forms) each needing model+parser+serializer+builder.

### Estimated Scope
- **~55-65 new files**, **~11,000-16,500 lines** of code
- All greenfield — no existing code to refactor

### Top 3 Risks
1. **`fast-xml-parser` namespace handling** — The examples show `zeebe:modelerTemplate` as an attribute directly on `bpmn:serviceTask` elements. If `fast-xml-parser` can't preserve namespace-prefixed attributes, a `saxes`-based fallback is needed. **Prototype this first.**
2. **Layout algorithm** — Sugiyama with cycle handling, orthogonal routing, sub-process nesting, and overlap validation is the largest single component. Subtle bugs are expected.
3. **Roundtrip fidelity** — 30 BPMN files with complex expressions (FEEL with special characters, CDATA, multi-line content) must survive parse→serialize without semantic loss.

### Recommended Start
Infrastructure → XML layer prototype (risk reduction) → BPMN model/parser/serializer with roundtrip tests → Builder → Layout → DMN → Forms → Docs.

Full assessment saved to session plan.md.
