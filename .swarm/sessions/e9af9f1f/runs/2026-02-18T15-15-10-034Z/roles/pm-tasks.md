# pm-tasks Summary

**Timestamp:** 2026-02-18T15:15:31.900Z

## Decomposed Tasks

1. Define XmlElement type and implement XML parsing/serialization core using fast-xml-parser with support for all 8 namespace prefixes and opaque unknown-extension preservation
2. Define BPMN internal model TypeScript interfaces and implement BPMN XML parser (XML to typed model with XmlElement[] for unknown extensions) and BPMN XML serializer (typed model back to semantically equivalent XML)
3. Implement BPMN fluent builder API: Bpmn.createProcess() entry point, method chaining for all element types (tasks, events, gateways, call activities, ad-hoc sub-processes), gateway branch(name, callback) with sub-builders, connectTo(id) for merging and loops, including aspirational element support
4. Implement DMN model types, XML parser, XML serializer, and Dmn.createDecisionTable() fluent builder with multi-output decision table support
5. Implement Form model types, JSON parser, JSON serializer, and Form.create() fluent builder supporting all 8 component types, recursive groups, and layout property preservation
6. Implement auto-layout engine: Sugiyama/layered algorithm with DFS back-edge detection and reversal, fixed element sizes (events 36x36, tasks 100x80, gateways 50x50), minimum spacing (80px H, 60px V), orthogonal edge routing, nested sub-process layout passes, overlap assertion, and best-effort edge-crossing minimization
7. Implement REST connector convenience builder as syntactic sugar on top of BPMN task builder
8. Add Vitest roundtrip tests for all 35 example files (BPMN, DMN, Form) validating semantic equivalence by re-parsing exported output and comparing model structures
9. Add Vitest builder unit tests for all element types including aspirational elements, covering gateway fan-out/fan-in patterns, parallel gateways, loops via connectTo, ad-hoc sub-processes with multi-instance, and REST connector builder
