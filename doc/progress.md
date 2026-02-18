# Progress

## 2026-02-18

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
