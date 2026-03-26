# Reebe WASM — Web App Integration Guide

Run a full BPMN workflow engine in the browser with zero server dependency.

---

## Building the package

Install [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/), then:

```bash
# from the repo root
just build-wasm
# output lands in playground/pkg/
```

This produces:
```
playground/pkg/
  reebe_wasm.js        # JS glue module (ES module)
  reebe_wasm_bg.wasm   # the compiled engine (~300–600 KB brotli-compressed)
  reebe_wasm.d.ts      # TypeScript declarations
  package.json
```

---

## Loading the engine

### Plain HTML (no bundler)

```html
<script type="module">
  import init, { WasmEngine } from "./pkg/reebe_wasm.js";

  await init(); // fetches and compiles the .wasm file
  const engine = new WasmEngine();

  engine.deploy(bpmnXmlString);
  engine.createProcessInstance("my-process", JSON.stringify({ orderId: "123" }));

  console.log(engine.snapshot());
</script>
```

### Vite / Rollup / webpack

Copy or symlink `playground/pkg/` into your project, or point your bundler at it:

```js
// vite.config.js — mark the wasm file as an asset
import { defineConfig } from "vite";
export default defineConfig({
  optimizeDeps: { exclude: ["reebe-wasm"] },
});
```

```js
// your app code
import init, { WasmEngine } from "reebe-wasm";

await init();
const engine = new WasmEngine();
```

### React

```jsx
import { useEffect, useState } from "react";
import init, { WasmEngine } from "reebe-wasm";

export function useEngine() {
  const [engine, setEngine] = useState(null);

  useEffect(() => {
    init().then(() => setEngine(new WasmEngine()));
  }, []);

  return engine;
}
```

### Web Worker (recommended for complex processes)

Processing drains synchronously on the calling thread. For processes with many
steps, run the engine in a Worker to avoid blocking the UI:

```js
// engine-worker.js
import init, { WasmEngine } from "./pkg/reebe_wasm.js";

let engine;

self.onmessage = async ({ data: { type, payload } }) => {
  if (type === "init") {
    await init();
    engine = new WasmEngine();
    self.postMessage({ type: "ready" });
    return;
  }

  try {
    let result;
    if (type === "deploy")                  result = engine.deploy(payload.bpmnXml);
    else if (type === "createInstance")     result = engine.createProcessInstance(payload.processId, JSON.stringify(payload.variables ?? {}));
    else if (type === "completeJob")        result = engine.completeJob(payload.key, JSON.stringify(payload.variables ?? {}));
    else if (type === "advanceClock")       result = engine.advanceClock(payload.ms);
    else if (type === "snapshot")           result = engine.snapshot();

    self.postMessage({ type: "ok", result, snapshot: engine.snapshot() });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
```

```js
// main thread
const worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
worker.postMessage({ type: "init" });
worker.onmessage = ({ data }) => {
  if (data.type === "ok") renderSnapshot(data.snapshot);
};

worker.postMessage({ type: "createInstance", payload: { processId: "order-process", variables: { orderId: "123" } } });
```

---

## API reference

All methods are synchronous. Each call drains the engine to completion before
returning — if a service task is reached the engine stops and waits for
`completeJob`.

### `new WasmEngine()`

Creates a new engine instance with an empty in-memory state and a virtual clock
initialized to the current wall-clock time.

---

### `engine.deploy(bpmnXml: string): object`

Deploy a BPMN 2.0 XML string. Multiple processes can be deployed to the same
engine instance. Returns a deployment result object.

```js
const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ...>
  <bpmn:process id="order-process" isExecutable="true">
    ...
  </bpmn:process>
</bpmn:definitions>`;

engine.deploy(bpmnXml);
```

---

### `engine.createProcessInstance(bpmnProcessId: string, variables: string): object`

Start a process instance. `variables` is a JSON string. The engine drains
synchronously: by the time this returns, the process has advanced as far as it
can (until it hits a service task, receive task, user task, timer, or end event).

```js
const result = engine.createProcessInstance(
  "order-process",
  JSON.stringify({ orderId: "123", amount: 99.99 })
);
```

---

### `engine.cancelProcessInstance(processInstanceKey: number): object`

Cancel a running process instance.

```js
engine.cancelProcessInstance(result.processInstanceKey);
```

---

### `engine.getActivatableJobs(jobType: string): Job[]`

Return all jobs waiting to be activated for the given job type. Call this after
`createProcessInstance` (or `completeJob`) to find service tasks the user should
act on.

```js
const jobs = engine.getActivatableJobs("payment-service");
// jobs[0].key, jobs[0].jobType, jobs[0].processInstanceKey, ...
```

---

### `engine.activateJob(key: number, worker: string, timeoutMs: number): object`

Activate a job, claiming it for a worker with a deadline.

```js
engine.activateJob(jobs[0].key, "playground-worker", 30_000);
```

---

### `engine.completeJob(key: number, variables: string): object`

Complete an activated job and resume the process. `variables` is a JSON string
of output variables that will be merged into the process scope.

```js
engine.completeJob(jobs[0].key, JSON.stringify({ status: "paid", txId: "tx-123" }));
```

---

### `engine.failJob(key: number, retries: number, errorMessage: string): object`

Fail a job. If `retries` reaches 0, an incident is created and the process
halts at that element.

```js
engine.failJob(jobs[0].key, 2, "Payment gateway timeout");
```

---

### `engine.throwError(key: number, errorCode: string, errorMessage: string): object`

Throw a BPMN error from a job. If an error boundary event with a matching code
is attached to the element, the process continues via that path. Otherwise an
incident is created.

```js
engine.throwError(jobs[0].key, "PAYMENT_FAILED", "Card declined");
```

---

### `engine.publishMessage(name: string, correlationKey: string, variables: string): object`

Publish a message for correlation with a waiting receive task or intermediate
catch event. `correlationKey` must match the value the waiting instance is
subscribed to.

```js
engine.publishMessage(
  "payment-received",
  "order-123",
  JSON.stringify({ amount: 99.99 })
);
```

---

### `engine.broadcastSignal(signalName: string, variables: string): object`

Broadcast a signal to all waiting signal catch events.

```js
engine.broadcastSignal("shutdown", JSON.stringify({}));
```

---

### `engine.advanceClock(ms: number): null`

Advance the virtual clock by the given number of milliseconds and immediately
fire any timers that become due. Use this to test timer boundary events,
intermediate timer catch events, and timer start events.

```js
// advance 5 minutes — fires any timers due within that window
engine.advanceClock(5 * 60 * 1000);
```

---

### `engine.tick(): null`

Fire timers due at the current clock time without advancing the clock. Useful
if you called `VirtualClock.set()` externally or want to re-check after a
manual time change.

---

### `engine.snapshot(): EngineSnapshot`

Return the full engine state as a plain JS object. Call this after every
command to refresh your UI.

```ts
interface EngineSnapshot {
  processInstances: ProcessInstance[];
  elementInstances: ElementInstance[];
  jobs:             Job[];
  variables:        Variable[];
  incidents:        Incident[];
  timers:           Timer[];
  eventLog:         Record[];
}
```

---

## Snapshot types

### `ProcessInstance`

```ts
interface ProcessInstance {
  key:                  number;
  partitionId:          number;
  bpmnProcessId:        string;
  processDefinitionKey: number;
  version:              number;
  state:                "ACTIVE" | "COMPLETED" | "CANCELED" | "TERMINATED";
  startDate:            string;   // ISO 8601
  endDate:              string | null;
  tenantId:             string;
}
```

### `ElementInstance`

Use this to highlight active elements on a BPMN diagram:

```ts
interface ElementInstance {
  key:                  number;
  partitionId:          number;
  processInstanceKey:   number;
  processDefinitionKey: number;
  elementId:            string;  // matches the BPMN XML id attribute
  elementType:          string;  // "SERVICE_TASK", "USER_TASK", "GATEWAY", etc.
  bpmnProcessId:        string;
  state:                "ACTIVE" | "COMPLETED" | "TERMINATED";
  flowScopeKey:         number | null;
}
```

```js
// find all currently active BPMN element IDs
const activeIds = snapshot.elementInstances
  .filter(e => e.state === "ACTIVE")
  .map(e => e.elementId);
// pass activeIds to bpmn-js Overlays or Canvas to highlight them
```

### `Job`

```ts
interface Job {
  key:                  number;
  partitionId:          number;
  jobType:              string;
  state:                "ACTIVATABLE" | "ACTIVATED" | "COMPLETED" | "FAILED" | "TIMED_OUT";
  processInstanceKey:   number;
  elementInstanceKey:   number;
  processDefinitionKey: number;
  bpmnProcessId:        string;
  elementId:            string;
  retries:              number;
  worker:               string | null;
  deadline:             string | null;
  errorCode:            string | null;
  errorMessage:         string | null;
  customHeaders:        object;
  variables:            object;
  createdAt:            string;
  tenantId:             string;
}
```

### `Variable`

```ts
interface Variable {
  name:               string;
  value:              any;   // parsed JSON value
  scopeKey:           number;
  processInstanceKey: number;
  tenantId:           string;
}
```

### `Incident`

```ts
interface Incident {
  key:                  number;
  processInstanceKey:   number;
  processDefinitionKey: number;
  elementInstanceKey:   number;
  elementId:            string;
  errorType:            string;  // "JOB_NO_RETRIES", "UNHANDLED_ERROR_EVENT", etc.
  errorMessage:         string | null;
  state:                "ACTIVE" | "RESOLVED";
  jobKey:               number | null;
  createdAt:            string;
  resolvedAt:           string | null;
  tenantId:             string;
}
```

### `Record` (event log)

```ts
interface Record {
  partitionId:     number;
  position:        number;
  recordType:      "COMMAND" | "EVENT";
  valueType:       string;   // "PROCESS_INSTANCE", "JOB", "DEPLOYMENT", etc.
  intent:          string;   // "CREATE", "CREATED", "ACTIVATE_ELEMENT", etc.
  recordKey:       number;
  timestampMs:     number;
  payload:         object;
  sourcePosition:  number | null;
  tenantId:        string;
}
```

---

## End-to-end example: order process with a payment service task

```js
import init, { WasmEngine } from "./pkg/reebe_wasm.js";

const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="order-process" isExecutable="true">
    <bpmn:startEvent id="start" />
    <bpmn:sequenceFlow id="sf1" sourceRef="start" targetRef="payment-task" />
    <bpmn:serviceTask id="payment-task" name="Process Payment">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-service" />
      </bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="sf2" sourceRef="payment-task" targetRef="end" />
    <bpmn:endEvent id="end" />
  </bpmn:process>
</bpmn:definitions>`;

await init();
const engine = new WasmEngine();

// 1. Deploy the process
engine.deploy(bpmnXml);

// 2. Start an instance — engine runs until it hits the service task
engine.createProcessInstance("order-process", JSON.stringify({
  orderId: "123",
  amount: 99.99,
}));

// 3. Inspect state — the process should be waiting at the payment task
const snap1 = engine.snapshot();
console.log("Active elements:", snap1.elementInstances.filter(e => e.state === "ACTIVE").map(e => e.elementId));
// → ["payment-task"]

// 4. Find the waiting job
const jobs = engine.getActivatableJobs("payment-service");
console.log("Waiting jobs:", jobs.length); // → 1

// 5. Simulate the worker completing the job
engine.activateJob(jobs[0].key, "playground-worker", 30_000);
engine.completeJob(jobs[0].key, JSON.stringify({ status: "paid", txId: "tx-abc" }));

// 6. Process is now complete
const snap2 = engine.snapshot();
console.log("Process state:", snap2.processInstances[0].state); // → "COMPLETED"
console.log("Variables:", snap2.variables);
// → [{ name: "orderId", value: "123" }, { name: "amount", value: 99.99 },
//    { name: "status", value: "paid" }, { name: "txId", value: "tx-abc" }]

// 7. Inspect the event log (educational — shows the event-sourced sequence)
snap2.eventLog.forEach(r => {
  console.log(`[${r.recordType}] ${r.valueType}.${r.intent} @ position ${r.position}`);
});
// [COMMAND] DEPLOYMENT.CREATE @ position 1
// [EVENT]   DEPLOYMENT.CREATED @ position 2
// [COMMAND] PROCESS_INSTANCE.CREATE @ position 3
// [EVENT]   PROCESS_INSTANCE.ELEMENT_ACTIVATING @ position 4
// ...
```

---

## Timer example

```js
const bpmnWithTimer = `...`; // process with a PT5M timer boundary event

engine.deploy(bpmnWithTimer);
engine.createProcessInstance("timer-process", "{}");

// Engine is waiting at the timer — advance time past the 5-minute mark
engine.advanceClock(6 * 60 * 1000); // +6 minutes

// Timer fired — process continued via the boundary path
const snap = engine.snapshot();
```

---

## Highlighting active elements with bpmn-js

```js
import BpmnViewer from "bpmn-js";

const viewer = new BpmnViewer({ container: "#canvas" });
await viewer.importXML(bpmnXml);

function render(snapshot) {
  const overlays = viewer.get("overlays");
  const canvas   = viewer.get("canvas");

  // clear previous highlights
  overlays.clear();

  // highlight active element instances
  for (const ei of snapshot.elementInstances) {
    if (ei.state !== "ACTIVE") continue;
    const color = ei.elementType.includes("TASK") ? "#3b82f6" : "#10b981";
    canvas.addMarker(ei.elementId, "active-element");
  }

  // mark elements with incidents
  for (const inc of snapshot.incidents) {
    if (inc.state !== "ACTIVE") continue;
    canvas.addMarker(inc.elementId, "has-incident");
  }
}
```

Add CSS:
```css
.active-element .djs-outline { stroke: #3b82f6 !important; stroke-width: 3px; }
.has-incident  .djs-outline { stroke: #ef4444 !important; stroke-width: 3px; }
```

---

## Limitations

- **In-memory only** — state is lost when the page is closed. Export `engine.snapshot()` as JSON and re-import if persistence is needed (not yet implemented).
- **Single-tenant** — all instances share the `<default>` tenant.
- **No gRPC** — the WASM engine only runs the processing core; there is no HTTP or gRPC server.
- **Single-threaded** — the engine runs on the thread that calls it. Use a Web Worker for complex processes to avoid blocking the UI.
- **Virtual clock** — time does not advance automatically. Call `engine.advanceClock(ms)` to move the clock and fire timers.
