# Progress

## 2026-02-19

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
