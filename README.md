# @urbanisierung/bpmn-sdk

[![npm version](https://img.shields.io/npm/v/@urbanisierung/bpmn-sdk)](https://www.npmjs.com/package/@urbanisierung/bpmn-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A TypeScript SDK for working with Camunda 8 process automation artifacts — BPMN, DMN, and Forms. Parse, build, and export process definitions programmatically with full type safety and roundtrip fidelity.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **BPMN** — Parse, build, and export BPMN 2.0 XML with full element support
- **DMN** — Parse, build, and export DMN decision tables with all hit policies
- **Forms** — Parse, build, and export Camunda Form JSON with 8 component types
- **Roundtrip fidelity** — Parse → export preserves semantic equivalence
- **Fluent builders** — Method-chaining APIs for constructing definitions programmatically
- **Auto-layout** — Sugiyama/layered layout algorithm with sub-process support
- **Full type safety** — Discriminated unions and strict TypeScript throughout
- **Zero runtime dependencies** — Only `fast-xml-parser` for XML handling

## Requirements

- **Node.js** ≥ 18 (latest LTS recommended)
- **TypeScript** ≥ 5.0 (for type-safe usage)

## Installation

```bash
npm install @urbanisierung/bpmn-sdk
```

```bash
pnpm add @urbanisierung/bpmn-sdk
```

```bash
yarn add @urbanisierung/bpmn-sdk
```

## Quick Start

### BPMN

```typescript
import { Bpmn } from "@urbanisierung/bpmn-sdk";

// Parse existing BPMN XML
const model = Bpmn.parse(xml);

// Build a new process
const definitions = Bpmn.createProcess("my-process")
  .name("My Process")
  .startEvent("start")
  .serviceTask("task-1", { taskType: "io.camunda:http-json:1" })
  .exclusiveGateway("gw-1")
  .branch("yes", (b) => b.condition("= approved").serviceTask("approve", { taskType: "approve-task" }))
  .branch("no", (b) => b.defaultFlow().serviceTask("reject", { taskType: "reject-task" }))
  .endEvent("end")
  .build();

// Export to XML
const xml = Bpmn.export(definitions);
```

### DMN

```typescript
import { Dmn } from "@urbanisierung/bpmn-sdk";

// Parse existing DMN XML
const model = Dmn.parse(xml);

// Build a new decision table
const definitions = Dmn.createDecisionTable("risk-level")
  .name("Risk Level")
  .hitPolicy("FIRST")
  .input({ label: "Age", expression: "age", typeRef: "integer" })
  .output({ label: "Risk", name: "risk", typeRef: "string" })
  .rule({ inputs: ["< 25"], outputs: ['"high"'], description: "Young driver" })
  .rule({ inputs: [">= 25"], outputs: ['"low"'], description: "Standard" })
  .toXml();
```

### Forms

```typescript
import { Form } from "@urbanisierung/bpmn-sdk";

// Parse existing form JSON
const model = Form.parse(json);

// Build a new form
const form = Form.create("my-form")
  .textField({ key: "name", label: "Full Name" })
  .select({
    key: "department",
    label: "Department",
    values: [
      { label: "Engineering", value: "eng" },
      { label: "Sales", value: "sales" },
    ],
  })
  .checkbox({ key: "agree", label: "I agree to the terms" })
  .build();

// Export to JSON
const json = Form.export(form);
```

## API Reference

### `Bpmn`

| Method | Description |
| --- | --- |
| `Bpmn.parse(xml)` | Parse BPMN XML string into a typed `BpmnDefinitions` model |
| `Bpmn.export(model)` | Serialize a `BpmnDefinitions` model to BPMN XML string |
| `Bpmn.createProcess(id)` | Create a new process using the fluent builder API |

**Builder highlights:**

- `startEvent()`, `endEvent()` — process boundaries
- `serviceTask()`, `userTask()`, `scriptTask()`, `sendTask()`, `receiveTask()`, `businessRuleTask()` — task types
- `exclusiveGateway()`, `parallelGateway()`, `inclusiveGateway()`, `eventBasedGateway()` — gateways with `branch()` pattern
- `subProcess()`, `adHocSubProcess()`, `eventSubProcess()` — sub-process containers
- `callActivity()` — external process invocation
- `restConnector()` — convenience builder for HTTP connector service tasks
- `connectTo(id)` — merge branches or create loops
- `boundaryEvent()` — attach events to activities

### `Dmn`

| Method | Description |
| --- | --- |
| `Dmn.parse(xml)` | Parse DMN XML string into a typed `DmnDefinitions` model |
| `Dmn.export(model)` | Serialize a `DmnDefinitions` model to DMN XML string |
| `Dmn.createDecisionTable(id)` | Create a new decision table using the fluent builder API |

**Supported hit policies:** `UNIQUE`, `FIRST`, `ANY`, `COLLECT`, `RULE ORDER`, `OUTPUT ORDER`, `PRIORITY`

### `Form`

| Method | Description |
| --- | --- |
| `Form.parse(json)` | Parse Camunda Form JSON string into a typed `FormDefinition` model |
| `Form.export(model)` | Serialize a `FormDefinition` model to JSON string |
| `Form.create(id?)` | Create a new form using the fluent builder API |

**Component types:** `text`, `textfield`, `textarea`, `select`, `radio`, `checkbox`, `checklist`, `group`

## TypeScript Usage

The SDK exports all model types for fully typed workflows:

```typescript
import type {
  BpmnDefinitions,
  BpmnServiceTask,
  BpmnFlowElement,
} from "@urbanisierung/bpmn-sdk";

// Use discriminated unions to narrow element types
function getServiceTasks(definitions: BpmnDefinitions): BpmnServiceTask[] {
  return definitions.processes
    .flatMap((p) => p.flowElements)
    .filter((el): el is BpmnServiceTask => el.type === "serviceTask");
}
```

### REST Connector

Build HTTP connector service tasks with a dedicated convenience API:

```typescript
import { Bpmn } from "@urbanisierung/bpmn-sdk";

const definitions = Bpmn.createProcess("api-call")
  .startEvent("start")
  .restConnector("fetch-users", {
    method: "GET",
    url: "https://api.example.com/users",
    authentication: { type: "bearer", token: "=secrets.API_TOKEN" },
    resultVariable: "response",
    resultExpression: "= response.body.users",
  })
  .endEvent("end")
  .build();
```

## Development

### Prerequisites

- Node.js (latest LTS)
- pnpm 10+

### Setup

```bash
pnpm install
```

### Commands

```bash
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm check        # Lint and format check
pnpm typecheck    # TypeScript type checking
pnpm verify       # Run all of the above
```

### Project Structure

```
packages/
  bpmn-sdk/        # Main SDK package (@urbanisierung/bpmn-sdk)
    src/
      bpmn/        # BPMN parser, serializer, builder, model
      dmn/         # DMN parser, serializer, builder, model
      form/        # Form parser, serializer, builder, model
      layout/      # BPMN auto-layout engine
      xml/         # Generic XML parser/serializer
      types/       # Shared types (XmlElement, ID generator)
    tests/         # Vitest test suites
examples/          # Real-world BPMN, DMN, and Form files for roundtrip testing
```

## Contributing

1. Fork the repository and create a feature branch
2. Install dependencies: `pnpm install`
3. Make your changes
4. Validate everything passes: `pnpm verify`
5. Add a changeset describing your change: `pnpm changeset`
6. Commit and open a pull request

### Versioning & Releases

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing. Every PR that changes package functionality should include a changeset.

```bash
pnpm changeset            # Create a new changeset (interactive)
pnpm version-packages     # Apply changesets and bump versions
pnpm release              # Build and publish to npm
```

### Code Quality

- **Formatter & Linter:** [Biome](https://biomejs.dev/) — run `pnpm check` before submitting
- **Type Safety:** TypeScript strict mode — zero type errors required
- **Tests:** [Vitest](https://vitest.dev/) — all tests must pass

## License

[MIT](./LICENSE)
