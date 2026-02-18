# Features

## Roundtrip Tests (2026-02-18)
- **34 example files tested** — 30 BPMN, 1 DMN, 3 Form files roundtrip through parse→export→re-parse
- **Typed model comparison** — validates semantic equivalence at the model level, not byte-level XML
- **XML-level roundtrip** — additional structural validation at the raw XML element tree level

## BPMN Support (2026-02-19)
- **Parse BPMN XML** — `Bpmn.parse(xml)` parses BPMN XML into a typed `BpmnDefinitions` model
- **Export BPMN XML** — `Bpmn.export(model)` serializes a `BpmnDefinitions` model back to BPMN XML
- **Fluent builder** — `Bpmn.createProcess(id)` creates processes with method chaining
- **Gateway support** — exclusive, parallel, inclusive, event-based gateways with `branch(name, callback)` pattern
- **Loop support** — `connectTo(targetId)` for merge points and back-edge loops
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content
- **Multi-instance** — parallel/sequential multi-instance with Zeebe extension elements
- **Aspirational elements** — sendTask, receiveTask, businessRuleTask builders
- **REST connector builder** — `restConnector(id, config)` convenience method generates service tasks with `io.camunda:http-json:1` task type, IO mappings (method, url, auth, body, headers, queryParameters, timeouts), and task headers (resultVariable, resultExpression, retryBackoff)
- **Extension preservation** — zeebe:*, modeler:*, camunda:* extensions roundtrip as `XmlElement[]`
- **Diagram interchange** — BPMNDI shapes and edges preserved on roundtrip

## Form Support (2026-02-18)
- **Parse Form JSON** — `Form.parse(json)` parses Camunda Form JSON into a typed `FormDefinition` model
- **Export Form JSON** — `Form.export(model)` serializes a `FormDefinition` model to JSON
- **8 component types** — text, textfield, textarea, select, radio, checkbox, checklist, group
- **Recursive groups** — nested group components with arbitrary depth

## DMN Support (2026-02-18)
- **Parse DMN XML** — `Dmn.parse(xml)` parses DMN XML into a typed `DmnDefinitions` model
- **Export DMN XML** — `Dmn.export(model)` serializes a `DmnDefinitions` model back to DMN XML
- **Fluent builder** — `Dmn.createDecisionTable(id)` creates decision tables with method chaining
- **Multi-output tables** — support for 2+ output columns per decision table
- **Hit policies** — UNIQUE (default), FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY
- **Roundtrip fidelity** — semantic equivalence preserved on parse→export cycle
- **Namespace preservation** — DMN, DMNDI, DC, modeler namespace declarations roundtrip correctly
