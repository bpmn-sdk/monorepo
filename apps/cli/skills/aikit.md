# BPMNKit AIKit — Tool Reference

This file is installed to `.claude/aikit.md` by `casen skills install`.
The skill files (`/design`, `/implement`, etc.) reference it with `@.claude/aikit.md`.

---

## MCP server

All tools are exposed by the `bpmnkit-aikit` MCP server configured in `.claude/mcp.json`.
Tool names follow the pattern `mcp__bpmnkit-aikit__<tool_name>`.

---

## BPMN tools

### `bpmn_create`

Generate a new BPMN process from a natural language description.

- Automatically loads a matching domain pattern for context before calling the AI.
- Writes the `.bpmn` file to disk.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `description` | yes | Natural language description of the process. Include actors, decision points, and expected outcomes. The richer the description, the better the diagram. |
| `outputDir` | no | Directory to write the file (default: current working directory). |

**Returns** `{ path: string, patternMatched: string | null }`

**Good description example:**
> "Invoice approval process with a clerk review step, automatic approval under €500, manager approval for higher amounts, and email notification on rejection."

---

### `bpmn_read`

Read a BPMN file and return its compact JSON representation.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `path` | yes | Path to the `.bpmn` file. |

**Returns** Compact JSON with shape:
```json
{
  "id": "process-id",
  "processes": [{
    "id": "...", "name": "...",
    "elements": [
      { "type": "startEvent", "id": "...", "name": "..." },
      { "type": "serviceTask", "id": "...", "name": "...", "jobType": "com.example:do-thing:1" },
      { "type": "userTask", "id": "...", "name": "...", "formId": "approve-form" },
      { "type": "businessRuleTask", "id": "...", "name": "...", "decisionId": "credit-check" },
      { "type": "exclusiveGateway", "id": "...", "name": "..." },
      { "type": "endEvent", "id": "...", "name": "..." }
    ]
  }]
}
```

Use `jobType` to identify service tasks for worker scaffolding. Use `formId` / `decisionId` to know which tasks need forms/DMN tables.

---

### `bpmn_update`

Update an existing BPMN by describing the change in natural language.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `path` | yes | Path to the `.bpmn` file. |
| `instruction` | yes | What to change, e.g. "Add an error boundary event on the payment task that routes to a manual review lane." |

**Returns** `{ path: string, updated: true }`

---

### `bpmn_validate`

Validate a BPMN file using the BPMNKit pattern advisor.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `path` | yes | Path to the `.bpmn` file. |

**Returns**
```json
{
  "summary": { "total": 3, "errors": 1, "warnings": 1, "info": 1, "autoFixable": 2 },
  "findings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "string",
      "message": "string",
      "suggestion": "string",
      "elementIds": ["..."],
      "autoFixable": true
    }
  ]
}
```

Errors block deployment. Warnings and info are advisory.

---

### `bpmn_deploy`

Deploy a BPMN process to a running engine.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `path` | yes | Path to the `.bpmn` file. |
| `target` | yes | `"local"` — local reebe instance (uses `ZEEBE_ADDRESS`). `"camunda8"` — active Camunda 8 profile (set with `casen profile create`). |

**Returns** `{ success: true, target: string, result: object }`

---

### `bpmn_simulate`

Structural analysis: validation findings + worker coverage check.

> **Note:** Phase 1 only — structural analysis. Full process execution simulation is planned for a future phase.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `path` | yes | Path to the `.bpmn` file. |

**Returns**
```json
{
  "validation": { "errors": 0, "findings": [] },
  "workerCoverage": {
    "total": 3,
    "covered": 2,
    "missing": ["com.example:send-invoice:1"]
  }
}
```

---

### `bpmn_run_history`

Query recent process executions from the local proxy.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `processId` | no | Filter by process definition ID. |

**Returns** `{ runs: [...] }` — up to 20 recent executions.

---

## Worker tools

### `worker_list`

List all available workers: built-in BPMNKit workers and any scaffolded workers found in `./workers/`.

**Parameters** none

**Returns** `{ workers: [{ jobType, name, description, ... }], total: number }`

---

### `worker_scaffold`

Scaffold a TypeScript worker for a Zeebe job type. Generates `index.ts`, `package.json`, `tsconfig.json`, `README.md` in `./workers/<slug>/`.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `jobType` | yes | Zeebe job type string, e.g. `com.example:send-invoice:1`. |
| `description` | no | What this worker does. |
| `inputs` | no | Object mapping input variable names to type descriptions, e.g. `{ "invoiceId": "string", "amount": "number" }`. |
| `outputs` | no | Object mapping output variable names to type descriptions. |

**Returns** `{ path: string, files: [...], jobType: string, note: string }`

After scaffolding: `cd workers/<slug> && npm install && npm start`. Edit `index.ts` to implement `handle()`.

---

## Form & DMN tools

### `form_create`

Generate Camunda form JSON for all `userTask` elements in a BPMN that have a `formId`. Writes one `.form` file per task.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `bpmnPath` | yes | Path to the `.bpmn` file. |
| `outputDir` | no | Where to write form files (default: same directory as the BPMN). |

**Returns**
```json
{
  "forms": [
    { "taskId": "...", "taskName": "...", "formId": "...", "path": "path/to/form-id.form" }
  ]
}
```

Returns `{ "forms": [] }` if no user tasks with `formId` are found.

---

### `dmn_create`

Generate DMN decision table XML for all `businessRuleTask` elements in a BPMN that have a `decisionId`. Writes one `.dmn` file per task.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `bpmnPath` | yes | Path to the `.bpmn` file. |
| `outputDir` | no | Where to write DMN files (default: same directory as the BPMN). |

**Returns**
```json
{
  "decisions": [
    { "taskId": "...", "taskName": "...", "decisionId": "...", "path": "path/to/decision-id.dmn" }
  ]
}
```

Returns `{ "decisions": [] }` if no business rule tasks with `decisionId` are found.

---

## Pattern tools

### `pattern_list`

List all available domain process patterns.

**Parameters** none

**Returns** `{ patterns: [{ id, name, description, keywords }], total: number }`

Call this at the start of any skill to check whether a domain pattern applies. Match by comparing keywords against the user's request.

---

### `pattern_get`

Get the full content of a domain pattern: readme, worker specs, variations, and a compact BPMN template.

**Parameters**
| Name | Required | Description |
|---|---|---|
| `domain` | yes | Pattern id (e.g. `"invoice-approval"`) or free-text query (e.g. `"employee onboarding"`). |

**Returns** `{ id, name, description, keywords, readme, workers, variations, template }`

Pass `pattern.readme` and `pattern.workers` as additional context in the `description` parameter of `bpmn_create`.
