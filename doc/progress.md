# Progress

## 2026-02-20

### Minimum Row Gap Between Elements & Gateway Label Position
- **Minimum row gap**: `distributeSplitBranches()` now uses two-pass processing (multi-branch first, single-branch second) with peer-aware gap enforcement. Single-branch gateways check all chain nodes against layer peers and push further away if any gap would be less than `GRID_CELL_HEIGHT/2` (80px).
- **Gateway labels**: Labels moved from centered-above to **top-right** position (`x = bounds.right + 4, y = bounds.top - labelHeight - 4`), preventing overlap with upward edge paths.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Symmetric Branch Distribution for Split Gateways
- **Symmetric branches**: Added `distributeSplitBranches()` — branches of split gateways with 2+ non-baseline branches are now equally distributed above and below the gateway center Y, spaced by `GRID_CELL_HEIGHT` (160px)
- **Single-branch gateways**: Gateways with exactly 1 non-baseline branch (e.g., early-return splits) now place the branch a full `GRID_CELL_HEIGHT` away from the gateway center, ensuring clear separation from inner gateway branches
- **Layer overlap resolution**: Added `resolveLayerOverlaps()` — after redistribution, overlapping nodes within the same layer are pushed apart with minimum gap, and coordinates are normalized to ensure no negative Y values
- Example result: `parallelStart` (cy=251) branches at processPayment (cy=171) and checkInventory (cy=331); early return at notifyRejection/endRejected (cy=91) — one full grid row above
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Collapsed Sub-Processes & Baseline Continuation Through Early-Return Splits
- **Collapsed sub-processes**: Sub-processes now render at 100×80 (same as regular tasks) instead of being expanded to show child elements. Removed the sub-process expansion phase from the layout engine.
- **Baseline continuation**: `findContinuationSuccessor()` now correctly follows gateway successors as baseline continuation points. When a split gateway has one early-return branch (dead-end) and one branch leading to another gateway, the gateway branch is chosen as the baseline continuation. Non-gateway branches are never promoted to the baseline.
- **Overlap fix**: Fixed 3 test failures caused by branch nodes being incorrectly placed on the baseline (overlapping siblings). The fix ensures that only gateway successors are followed as continuation, preventing branch content from being aligned to the baseline Y.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Baseline Path Alignment & Gateway Edge Fix
- **Baseline path detection**: Added `findBaselinePath()` that identifies the process "spine" — the sequence of nodes every path must traverse (start event → gateways → end event), skipping branch content
- **Baseline Y-alignment**: Added `alignBaselinePath()` that forces all spine nodes to share the same center-Y, ensuring start and end events are horizontally aligned
- **Gateway incoming edge fix**: Updated `resolveTargetPort()` to distinguish split (starting) vs join (closing) gateways:
  - Split gateways: incoming edges always connect from the left
  - Join gateways: incoming edges connect based on relative position (above→top, below→bottom, same Y→left)
- Added 5 new tests: baseline path detection (2), baseline Y-alignment (2), split gateway left-side port (1)
- Verification: `pnpm verify` — 287 tests pass, zero errors

### XML Attribute Value Escaping Fix
- Fixed `serializeXml()` to escape `"` as `&quot;` in XML attribute values
- Root cause: `fast-xml-parser` `XMLBuilder` with `processEntities: false` writes attribute values verbatim, producing invalid XML when values contain double quotes (e.g., FEEL expressions like `=erpBaseUrl + "/api/orders"`)
- Added regression test for attribute escaping and roundtrip
- Regenerated `order-process.bpmn` with proper escaping
- Verification: `pnpm verify` — 282 tests pass, zero errors

### Grid-Based Layout & Edge Routing Improvements
- **Virtual grid system**: Replaced cumulative-offset coordinate assignment with a 200×160 virtual grid
  - All elements placed in grid cells, centered horizontally and vertically within cells
  - Grid cells merge automatically for oversized elements (e.g., expanded sub-processes)
  - Grid constants: `GRID_CELL_WIDTH=200`, `GRID_CELL_HEIGHT=160`
- **Gateway size**: Changed gateway dimensions from 50×50 to 36×36 (matching BPMN standard)
- **L-shaped edge routing**: Forward edges now prefer L-shaped paths (1 bend) over Z-shaped paths (2 bends)
  - `routeForwardEdge()` produces horizontal→vertical L-shape instead of horizontal→vertical→horizontal Z-shape
  - `routeFromPortDirect()` also uses L-shaped routing from top/bottom ports
- **Early-return branch positioning**: Added `ensureEarlyReturnOffBaseline()` — shorter branches at gateway splits are swapped off the baseline so they're never on the split gateway's center-y
- **Edge connection rules** (unchanged, verified):
  - Non-gateway elements: outgoing from right center, incoming to left center
  - Starting gateways: incoming on left, vertically centered
  - Closing gateways: incoming from top/bottom/left based on relative position
- Added 5 new tests: grid cell centering, grid layer spacing, grid row spacing, L-shaped edge preference, early-return off-baseline
- Verification: `pnpm verify` — build, typecheck, check, test (281 pass) — all zero errors

### Edge Routing & Vertical Spacing Improvements
- Changed `VERTICAL_SPACING` from 80px to 160px for better visual separation between branches
- Added `resolveTargetPort()` to determine edge entry side: non-gateway targets always enter from the left; gateway targets enter top/bottom/left based on source relative Y position (with +/-1px tolerance)
- Integrated `resolveTargetPort` into `routeForwardEdge()` and `routeFromPortDirect()` for correct target-side routing
- Added 2 new `resolveTargetPort` test cases (non-gateway always left, gateway Y-based with tolerance)
- Added 2 integration tests in `builder-layout-integration.test.ts` for non-gateway left-entry and branch vertical spacing
- Verification: `pnpm turbo build`, `pnpm turbo test` (276 pass), `pnpm biome check .`, `pnpm turbo typecheck` — all zero errors

## 2026-02-19

### Layout Engine QA Fixes — Branch Alignment, Split/Join, Labels, Routing
- **Branch baseline alignment**: Added `alignBranchBaselines()` to `coordinates.ts` — nodes in linear sequences (non-gateway, single-pred/single-succ chains) now share the same center-y coordinate
- **Split/join Y-alignment**: Added `alignSplitJoinPairs()` to `coordinates.ts` — merge gateways are forced to the same y-coordinate as their corresponding split gateway
- **Edge label collision avoidance**: Replaced simple midpoint label placement with collision-aware system in `routing.ts`:
  - Generates 5 candidate positions along the longest edge segment (at 25%/33%/50%/67%/75%) with above/below offsets
  - Greedy placement: processes labels in order, picks first non-overlapping candidate
  - Fallback: slides label along segment in 10 steps to find clear space
- **Edge routing efficiency**: `routeFromPort()` now compares assigned-port route against right-port route by bend count, preferring the assigned port unless right-only gives strictly fewer bends; back-edges now evaluate routing above vs. below all nodes and pick the shorter path
- **VERTICAL_SPACING test fix**: Updated test to check against imported `VERTICAL_SPACING` constant instead of hardcoded `60`
- Integrated `alignBranchBaselines` and `alignSplitJoinPairs` as phases 4b/4c in `layout-engine.ts`
- Added 8 new tests: linear baseline alignment, branch divergence, fork/join parallel alignment, fork/join exclusive alignment, label-node non-overlap, label-label non-overlap, forward edge bend limit, gateway bend efficiency
- All 272 tests pass, zero lint errors, zero build warnings

### Gateway Port Assignment for Auto-Layout
- Added gateway port assignment logic to `routing.ts` — gateway outgoing edges now follow BPMN port conventions
  - Odd outgoing edges: middle edge exits right, upper half exits top, lower half exits bottom
  - Even outgoing edges: upper half exits top, lower half exits bottom (no right port)
  - Single outgoing edge: exits right (straight horizontal)
- Added `routeFromPort()` Z-shaped routing from top/bottom ports, keeping vertical segments in the safe mid-zone between layers
- Exported `assignGatewayPorts` and `PortSide` type for direct unit testing
- 8 new tests covering port assignment (1/2/3/4/5 edges, empty, waypoint positions, non-gateway passthrough)
- All 277 tests pass, zero lint errors, zero build warnings

### Auto-Layout Documentation
- Added auto-layout section to README with full usage example showing `.withAutoLayout()` on a gateway workflow
- Added `withAutoLayout()` to builder methods table in API reference under new "Layout" category
- Expanded `doc/features.md` auto-layout entry with configuration details (opt-in behavior, element sizing, round-trip fidelity)

### Builder Layout Integration Tests
- Added `builder-layout-integration.test.ts` with 15 integration tests verifying auto-layout data generation for builder-created workflows
- Tests cover: shape/edge completeness, valid bounds, no overlaps, left-to-right ordering, DI ID conventions, orthogonal edge routing, element-type sizing, subprocess child containment, complex multi-pattern workflows, export→parse roundtrip, double roundtrip, and XML element verification
- Added round-trip position stability test to `bpmn-builder.test.ts`
- Updated `examples/create-workflow.ts` to use `.withAutoLayout()`
- Regenerated `order-process.bpmn` example output with layout data

## 2026-02-18

### Builder errorCode→errorRef Fix
- Fixed `buildEventDefinitions` to auto-generate a root `BpmnError` element when `errorCode` is provided without `errorRef`, ensuring boundary events built with only `errorCode` serialize with a valid `errorRef`

### Review Fixes
- Fixed `buildEventDefinitions` to pass `timeDate` and `timeCycle` into timer event definitions
- Fixed `buildEventDefinitions` to store `messageName`/`signalName`/`escalationCode` as `messageRef`/`signalRef`/`escalationRef`
- Added `timeDate`, `timeCycle` (and attribute maps) to `BpmnTimerEventDefinition` model type
- Added `timeDate`/`timeCycle` parsing and serialization for XML roundtrip support
- Added duplicate ID check when merging branch elements into the main process
- Removed `.swarm` session artifacts from version control and added to `.gitignore`

### Comprehensive README Rewrite
- Rewrote root `README.md` with best-practices structure matching top-tier SDKs
- Added "Why this SDK?" section with value propositions
- Added feature matrix table (BPMN/DMN/Forms × Parse/Build/Export)
- Added advanced examples: REST connector, parallel branches, boundary events, sub-processes, roundtrip workflow, type narrowing
- Added "Best Practices" section: descriptive IDs, discriminated unions, branch patterns, roundtrip modifications, composable processes
- Enhanced API reference with return types and categorized builder methods table
- Added semantic versioning guidance to contributing section

### Enhanced README and Changesets
- Enhanced root `README.md` with badges (npm, TypeScript, license), table of contents, requirements section, yarn install option, expanded contributing guide with code quality expectations and release workflow
- Added TypeScript usage section with discriminated union type narrowing examples
- Added REST connector convenience builder example
- Fixed README code examples to use correct `taskType` property name (was `type`)
- Added MIT `LICENSE` file
- Changesets (`@changesets/cli`, `@changesets/changelog-github`) configured for version management and publishing
- Committed `.changeset/` directory with `config.json` and `README.md`
- Fixed changeset config to use `@changesets/changelog-github` with repo setting for PR/author links
- Added `changeset`, `version-packages`, and `release` scripts to root `package.json`
- Removed accidentally committed `.swarm/` session artifacts from version control
- Added `.swarm` to `.gitignore`
- Added auto-layout feature to README feature list
- Added GitHub Actions CI workflow (build, typecheck, lint, test on push/PR)
- Added GitHub Actions Release workflow using `changesets/action` for automated version PRs and npm publishing

### Timer Event Definition Attribute Roundtrip Fix
- Added `timeDateAttributes` and `timeCycleAttributes` to `BpmnTimerEventDefinition` model
- Parser now extracts attributes (e.g. `xsi:type`) from `timeDate` and `timeCycle` elements, matching existing `timeDuration` handling
- Serializer now emits those attributes on roundtrip, preventing loss of `xsi:type`

## 2026-02-19

### Auto-Layout for ProcessBuilder
- Added `withAutoLayout()` fluent method to `ProcessBuilder` — when enabled, `build()` runs the Sugiyama layout engine and populates `BpmnDiagram` with DI shapes (bounds) and edges (waypoints)
- Layout-to-DI conversion maps `LayoutResult` nodes/edges to `BpmnDiShape`/`BpmnDiEdge` with proper element references
- Without `withAutoLayout()`, behavior is unchanged (`diagrams: []`)
- 4 new tests: default empty diagrams, linear flow DI, gateway branch DI, export→parse roundtrip with DI

### BPMN Fluent Builder API — Full Implementation
- Rewrote `bpmn-builder.ts` with complete fluent builder API (~1400 lines)
- **Gateway branching**: `branch(name, callback)` with `BranchBuilder` sub-builders
  - `condition(expression)` sets FEEL condition on branch sequence flow
  - `defaultFlow()` marks branch as gateway default path
  - Both conditions and defaults work with direct `connectTo()` (no intermediate elements)
- **Flow control**: `connectTo(id)` for merging branches and creating loops (backward references)
- **Navigation**: `element(id)` repositions builder at existing element for additional outgoing flows
- **Multiple start events**: `addStartEvent()` creates disconnected start events for parallel paths
- **Boundary events**: `boundaryEvent(id, options)` attached to activities with error/timer/message/signal support
- **Event definitions**: Timer (duration/date/cycle), message, signal, escalation on start/intermediate/boundary events
- **Ad-hoc sub-process**: `activeElementsCollection` and `loopCharacteristics` with full zeebe extension support
- **Modeler template**: `modelerTemplate`, `modelerTemplateVersion`, `modelerTemplateIcon` on service tasks
- **Version tag**: `versionTag(tag)` on process
- **`build()` returns `BpmnDefinitions`** (not just `BpmnProcess`) with full namespace declarations
- **Aspirational elements**: inclusive gateway, event-based gateway, sub-process, event sub-process, send/receive tasks
- Added `BpmnMessageEventDefinition` and `BpmnSignalEventDefinition` to model types
- Updated `src/index.ts` exports for all new option types
- 52 builder tests covering all features including 9-branch fan-out pattern
- Fixed existing tests (rest-connector, roundtrip) for new `build()` return type
- All 226 tests pass, zero lint errors, zero build warnings

### BPMN Builder Unit Tests (52 tests)
- Extended BPMN model with aspirational types: `sendTask`, `receiveTask`, `eventSubProcess`, `BpmnSubProcess`, `BpmnInclusiveGateway`, `BpmnEventBasedGateway`
- Rewrote `ProcessBuilder` with full gateway support: exclusive, parallel, inclusive, event-based
- Added `branch(name, callback)` pattern with `BranchBuilder` for gateway fan-out
- Added `connectTo(targetId)` for merge points and loop patterns
- Added sub-process builders: `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with `SubProcessContentBuilder`
- Added multi-instance configuration (parallel/sequential) with Zeebe extension elements
- Added aspirational element builders: `sendTask()`, `receiveTask()`, `businessRuleTask()`
- Added `recomputeIncomingOutgoing()` to fix up incoming/outgoing arrays at build time
- 52 comprehensive tests covering: linear flow, all validated element types, all aspirational types, exclusive gateway (2-branch and 9-branch fan-out), parallel gateway (2 and 3 branches), inclusive gateway, event-based gateway, loops via connectTo, ad-hoc sub-processes with multi-instance, sub-processes, event sub-processes, boundary events, error handling, complex nested patterns

### BPMN Parser/Serializer Lint Cleanup
- Fixed 14 `noNonNullAssertion` lint errors in `bpmn-roundtrip.test.ts`
- Added bounds-checked `at()` helper to replace `arr[i]!` patterns
- Replaced `find()!` with proper `undefined` checks and early returns
- All 226 tests pass, zero lint errors, zero build warnings

### REST Connector Convenience Builder
- Implemented `restConnector(id, config)` as syntactic sugar on `ProcessBuilder`
- Generates `io.camunda:http-json:1` service tasks with proper Zeebe extensions
- Supports GET/POST/PATCH/PUT/DELETE methods, bearer/noAuth authentication
- IO mapping inputs: method, url, authentication, body, headers, queryParameters, timeouts
- Task headers: resultVariable, resultExpression, retryBackoff (only when configured)
- Headers and queryParameters accept both FEEL strings and Record<string, string> (auto-serialized)
- 16 tests covering all patterns including real-world GitHub API example
- Fixed tests to work with updated `build()` return type (`BpmnDefinitions`)

## 2026-02-18

### QA Fixes
- Fixed duplicate `message`/`signal` switch cases in `bpmn-serializer.ts` (caused build failure)
- Fixed sub-process child node positioning in layout engine — children now correctly track parent shifts after `reassignXCoordinates`
- Auto-formatted `bpmn-serializer.ts` with Biome

### Roundtrip Tests for All Example Files
- Fixed build errors in BPMN builder and layout modules (model type alignment)
- Verified Vitest roundtrip tests for all 34 example files (30 BPMN, 1 DMN, 3 Form)
- BPMN roundtrip: parse → serialize → re-parse → deep model comparison (BpmnDefinitions)
- DMN roundtrip: parse → export → re-parse → field-level comparison (DmnDefinitions)
- Form roundtrip: parse → export → re-parse → deep equality (FormDefinition)
- XML-level roundtrip: parse → serialize → re-parse → structural comparison (XmlElement tree)
- All 169 roundtrip-related tests pass

### BPMN Support
- Added BPMN model types (`BpmnDefinitions`, `BpmnProcess`, `BpmnFlowElement` discriminated union, DI types)
- Added BPMN XML parser (`Bpmn.parse()`) with support for all element types in examples
- Added BPMN XML serializer (`Bpmn.export()`) with namespace-aware reconstruction
- Added `Bpmn.createProcess()` fluent builder with service tasks, script tasks, user tasks, call activities, REST connector sugar
- Added Form model types, parser (`Form.parse()`), serializer (`Form.export()`), and builder
- Added auto-layout engine (Sugiyama/layered algorithm with sub-process support)

### DMN Support
- Added DMN model types (`DmnDefinitions`, `DmnDecision`, `DmnDecisionTable`, `DmnInput`, `DmnOutput`, `DmnRule`)
- Added generic XML parser/serializer using `fast-xml-parser` with namespace-aware roundtrip support
- Added DMN XML parser (`Dmn.parse()`)
- Added DMN XML serializer (`Dmn.export()`)
- Added `Dmn.createDecisionTable()` fluent builder with:
  - Input columns (label, expression, typeRef)
  - Output columns (label, name, typeRef) — multi-output support
  - Rules with input/output entries and descriptions
  - All 7 hit policies (UNIQUE, FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY)
  - Auto-generated diagram shapes
  - XML export via `.toXml()`
- Added shared `XmlElement` type for opaque extension element preservation
- Added roundtrip test against `Github>Slack users.dmn` (2-output table, 21 rules)
- Set up monorepo infrastructure (pnpm, Turborepo, Biome, Vitest, TypeScript strict)
