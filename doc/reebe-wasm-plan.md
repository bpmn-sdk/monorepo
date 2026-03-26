# Reebe WASM Playground — Feasibility Analysis & Design Plan

> Goal: run BPMN process definitions interactively in the browser with zero server dependency.
> Not for production use — a developer playground.

---

## What the goal actually is

A **browser playground** means:
- User pastes/uploads a BPMN file
- Clicks "run", creates variables, triggers jobs
- Watches the process execute step by step in the browser
- Zero server required — no Docker, no install

This is meaningfully different from "compile reebe-server to WASM". The REST API, gRPC, clustering, auth, metrics, TCP, and a persistent database are all unnecessary. What's needed is the **processing core** only.

---

## Tier 1: Zero-refactor wins (exportable today)

### `reebe-bpmn` — Pure WASM already
All dependencies: `serde`, `serde_json`, `quick-xml`, `thiserror`, `chrono`. No async, no I/O. Compile to `wasm32-unknown-unknown` with `wasm-pack` today, zero changes. Can parse BPMN XML and return the process graph.

### `reebe-feel` — Pure WASM already
Same story. Pure computation. The FEEL evaluator can live in the browser to evaluate sequence flow conditions, timer durations, input/output mappings. Standalone WASM library, done in a day.

### `reebe-dmn` — Pure WASM already
Same story. Decision table evaluation.

These three form a **BPMN analysis layer** that can be shipped as an NPM package (`@reebe/bpmn`, `@reebe/feel`) immediately. They are already architecturally separated.

---

## Tier 2: What needs to change for a full in-browser engine

### Architecture principle

The refactoring is **additive, not replacing**. The existing Postgres and SQLite paths stay completely intact. The changes formalize what is already implicitly there:

```
StateBackend (trait)
    ├── SqlxBackend<Postgres>  ← current server behavior, unchanged
    ├── SqlxBackend<SQLite>    ← current embedded behavior, unchanged
    └── InMemoryBackend        ← new, WASM-only
```

The engine is constructed with whichever backend the caller provides. The existing Cargo feature flags (`postgres`, `sqlite`, `embedded`) continue to control which backend compiles. The `reebe-wasm` crate simply never activates either DB feature.

**The 12 processors (the actual BPMN execution logic) are untouched.** The work is in making the seams around them injectable.

---

## Challenge 1: `sqlx` is the wrong database layer for WASM

The current architecture: processors are pure, the event log is SQL. Every state change goes through `partition_records`. This is correct for a server but the wrong coupling for WASM.

Processors read and write **typed state** (process instances, element instances, jobs, variables). They don't care that this state is in Postgres — that is an implementation detail of `reebe-db`.

**What needs to happen:** Extract a `StateBackend` trait.

```rust
#[async_trait]
pub trait StateBackend: Send + Sync {
    async fn insert_record(&self, record: &DbRecord) -> Result<i64>;
    async fn next_position_batch(&self, partition_id: i16, n: usize) -> Result<i64>;
    // ... repositories for PI, jobs, vars, etc.
}
```

Then provide:
- `SqlxBackend` — the current `reebe-db` implementation (server, unchanged)
- `InMemoryBackend` — a pure Rust in-memory hashmap implementation (WASM)

The `InMemoryBackend` has no `sqlx` dependency. It uses `BTreeMap`, `Vec`, and standard collections. Zero SQL. Zero filesystem.

**Difficulty:** Medium. The current repository types are tightly coupled to `sqlx` with hardcoded queries. They need to become trait objects. The processors themselves are already almost pure — they receive a `Writers` struct and fill it with events and follow-up commands. They don't touch the DB directly. The coupling is in `commit_results` and the repository calls inside processors. This is surgically fixable.

---

## Challenge 2: `tokio` is the wrong async runtime for the browser

Tokio's `full` feature pulls in OS threads, TCP, epoll, Unix signals — none of which exist in `wasm32-unknown-unknown`. But the engine's actual concurrency model is simple:

- One processing loop (sequential, drain-then-wait)
- One command receiver
- A heartbeat timer

For WASM you need:
1. **`wasm-bindgen-futures`** — bridges Rust `Future` with JavaScript `Promise`
2. A single-threaded executor (the browser's event loop IS the executor)
3. `wasm_bindgen_futures::spawn_local` instead of `tokio::spawn`
4. `gloo-timers` or `js-sys::Promise` timeout instead of `tokio::time::sleep`

**Key insight:** The polling loop exists because the DB is the communication channel between the API task and the processing task. With an in-memory backend, commands are delivered directly and processing is instantaneous. The whole notification/polling machinery (LISTEN/NOTIFY, 5ms sleep) disappears. The engine can become fully synchronous or call-driven.

**Difficulty:** Medium. Tokio usage in `reebe-engine` is for task spawning and timers. With an in-memory backend and synchronous processing, the engine can be made fully synchronous or driven by `wasm-bindgen-futures`.

---

## Challenge 3: The event-sourcing loop and BPMN execution flow

Even a simple start→end process creates ~7 engine cycles, each writing to the event log. With an in-memory backend this is nanoseconds, but the sequential command processing loop still applies. Each `ACTIVATE_ELEMENT` command triggers another `ACTIVATE_ELEMENT` as output, which must be re-queued and re-processed.

For a playground, this is actually a feature: you can drain the engine synchronously until it reaches a waiting state (awaiting a job or timer), then hand control back to the user.

**The WASM architecture becomes call-driven:**

```
User: "Create Process Instance"
    → engine.submit(CREATE_PROCESS_INSTANCE)
    → engine drains: ACTIVATE_ELEMENT → COMPLETE_ELEMENT → ... → idle
    → returns snapshot to JS
JS: renders current state (highlights active elements)

User: "Complete Job" / "Advance Time"
    → engine drains again → returns snapshot
```

---

## Challenge 4: Timer events need a simulated clock

The scheduler polls for due timers using `Utc::now()`. In the browser, you can't spawn OS timer threads.

**Solution:** A `VirtualClock` and an `advance_clock(ms)` API.

```rust
pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

pub struct RealClock;
impl Clock for RealClock {
    fn now(&self) -> DateTime<Utc> { Utc::now() }
}

pub struct VirtualClock {
    current: Arc<Mutex<DateTime<Utc>>>
}
impl Clock for VirtualClock {
    fn now(&self) -> DateTime<Utc> { *self.current.lock().unwrap() }
}
```

Scattered `Utc::now()` calls in processors (approximately 15–20 call sites) go through this injectable clock. The playground exposes a time slider or "fast-forward" button.

---

## Challenge 5: Job workers need a simulated worker

A BPMN service task creates a `JOB` record and waits for a worker to activate and complete it. In a server environment, real workers call `/v2/jobs/activation`. In the playground, the user IS the worker.

**Solution:** The WASM API exposes job lifecycle methods:

```javascript
// JS side
const jobs = engine.getActiveJobs("payment-service");
// UI shows: "Service Task 'Process Payment' is waiting"
// User fills in output variables and clicks "Complete"
engine.completeJob(jobs[0].key, { status: "paid", transactionId: "tx-123" });
```

WASM exports needed:
- `get_activatable_jobs(job_type: &str) -> Vec<JobInfo>`
- `activate_job(key: i64, worker: &str) -> JobActivation`
- `complete_job(key: i64, variables: &str) -> Result`
- `fail_job(key: i64, retries: i32, error_message: &str) -> Result`
- `throw_error(key: i64, error_code: &str) -> Result`

With an in-memory backend these are simple hashmap operations.

---

## Challenge 6: State visibility for the playground UI

A playground needs to show:
- Which BPMN elements are currently active (for element highlighting)
- Variable values at each scope
- Incidents with their messages and root causes
- The partition_records event log (educational, shows the event-sourced sequence)

**Solution:** A `snapshot()` function returning a structured JSON representation:

```rust
#[wasm_bindgen]
pub fn snapshot(engine: &WasmEngine) -> JsValue {
    let snap = EngineSnapshot {
        process_instances: engine.backend.list_process_instances(),
        element_instances: engine.backend.list_element_instances(),
        jobs: engine.backend.list_jobs(),
        variables: engine.backend.list_variables(),
        incidents: engine.backend.list_incidents(),
        event_log: engine.backend.list_records(),
    };
    serde_wasm_bindgen::to_value(&snap).unwrap()
}
```

The event log is particularly valuable — showing users the event-sourced sequence of records is educational and makes the engine's behavior transparent.

---

## Challenge 7: Multi-threading is not available

`wasm32-unknown-unknown` runs in a single thread (main thread or a Web Worker). `DashMap` uses spin locks internally — technically safe in single-threaded WASM but unnecessary overhead. For the WASM build, standard `HashMap` suffices.

**Recommended pattern:** Run the WASM engine in a Web Worker to avoid blocking the UI thread.

```
Main thread (UI)               Web Worker (Engine)
      │                               │
      │  postMessage(command)         │
      │ ───────────────────────────>  │
      │                          process()
      │                               │
      │  <───────────────────────────  │
      │  onmessage(snapshot)          │
```

---

## Challenge 8: BPMN process deployment

Currently deployment stores the parsed BPMN as binary in the `deployments` table via `reebe-bpmn` and `bincode`. In the WASM engine, deployment is trivial — keep the parsed `Process` struct in memory.

The `ProcessDefCache` in `EngineState` already does this. For a single-user playground it is perfect as-is, with no changes needed.

---

## Challenge 9: The `wasm-bindgen` boundary

Every call across the Rust/JS boundary has serialization overhead. The engine currently passes `serde_json::Value` everywhere for payloads. For the playground API, pass variables as JSON strings:

```rust
#[wasm_bindgen]
pub fn create_process_instance(
    engine: &mut WasmEngine,
    bpmn_process_id: &str,
    variables: &str,  // JSON string — cheaper than JsValue tree conversion
) -> Result<JsValue, JsValue> { ... }
```

---

## Challenge 10: Binary size

A lean WASM bundle (no sqlx, no tokio networking, no axum, no tonic, in-memory backend) with `wasm-opt -Oz` and Brotli:

| Component | Estimated size |
|---|---|
| `regex` (DFA) | ~150 KB |
| `quick-xml` + serde | ~80 KB |
| `reebe-feel` | ~100–200 KB |
| Processors + engine core | ~300 KB |
| Total (gzipped) | **~300–600 KB** |

Perfectly acceptable for a playground.

---

## The new `reebe-wasm` crate

```
crates/reebe-wasm/
  src/
    lib.rs           # wasm-bindgen exports — public JS API
    backend.rs       # InMemoryBackend implementing StateBackend trait
    clock.rs         # VirtualClock
    engine.rs        # Thin WasmEngine wrapper
    snapshot.rs      # EngineSnapshot for JS state export
  Cargo.toml         # wasm32 target, wasm-bindgen, no sqlx/tokio/axum
```

**Dependencies:** only `reebe-bpmn`, `reebe-feel`, `reebe-dmn`, `reebe-protocol`, and the refactored `reebe-engine` (processors, extracted from DB layer). No `sqlx`, no `tokio` net/process/signal features, no `axum`, no `tonic`.

---

## What the JS API looks like

```javascript
import init, { WasmEngine } from "@reebe/engine-wasm";

await init(); // load .wasm file

const engine = new WasmEngine();

// Deploy a BPMN process
engine.deploy(bpmnXmlString);

// Create a process instance
const pi = engine.createProcessInstance("order-process", JSON.stringify({
  orderId: "123",
  amount: 99.99
}));

// Inspect current state
const snapshot = engine.snapshot();
// {
//   processInstances: [...],
//   elementInstances: [...],   // → use to highlight active elements on BPMN diagram
//   jobs: [...],
//   variables: [...],
//   incidents: [...],
//   eventLog: [...]             // → show event-sourced record stream
// }

// Complete a waiting job
const jobs = engine.getActiveJobs("payment-service");
engine.completeJob(jobs[0].key, JSON.stringify({ status: "paid" }));

// Advance virtual clock (for timers)
engine.advanceClock(5 * 60 * 1000); // +5 minutes
engine.tick(); // process any newly-due timers

// Publish a message (for message catch events)
engine.publishMessage("payment-received", "order-123", JSON.stringify({ amount: 99.99 }));
```

---

## What does NOT need solving for a playground

| Feature | Decision |
|---|---|
| gRPC | Skip entirely |
| Auth / tenancy | Skip entirely |
| REST API server | Replaced by direct WASM function calls |
| Clustering / advisory locks | Single-user, single-partition |
| Metrics export | Emit events to JS callbacks instead |
| Config files | Hardcode playground defaults |
| PostgreSQL | In-memory backend replaces it |
| Migration system | No DB to migrate |
| WAL / persistence | In-memory only; export/import state as JSON if needed |

---

## Challenges summary

| Challenge | Severity | Solution | Effort |
|---|---|---|---|
| `sqlx` coupling in engine | High | Extract `StateBackend` trait; `InMemoryBackend` | 3–4 weeks |
| `tokio` runtime | High | `wasm-bindgen-futures` or sync processing | 1–2 weeks |
| Hardcoded `Utc::now()` | Medium | Injectable `Clock` trait (~15–20 call sites) | 3–5 days |
| Job workers | Medium | Expose job lifecycle API to JS | 1 week |
| Timer scheduling | Medium | `advance_clock()` + virtual clock | 1 week |
| State visibility | Medium | `snapshot()` → JSON export | 3–5 days |
| Binary size | Low | `wasm-opt`, feature flags, dead code elimination | 2–3 days |
| `DashMap` in single-thread | Low | Replace with `HashMap` for WASM target | 1 day |
| `wasm-bindgen` boundary | Low | Pass JSON strings not JsValue trees | 1 day |
| Multi-threading | N/A | Web Worker model; engine is single-threaded | 1 day (setup) |
| Persistence | N/A | In-memory only; JSON export/import optional | None |

**Total realistic effort: 6–8 weeks** for a functional browser playground that runs real BPMN processes.

---

## Existing crates that need changes

| Crate | Change | Scope |
|---|---|---|
| `reebe-db` | Extract `StateBackend` trait; existing SqlxBackend unchanged | Additive |
| `reebe-engine` | Accept `Arc<dyn StateBackend>` + `Arc<dyn Clock>` instead of hardcoded `DbPool` | Surgical wiring |
| Processors | Replace `Utc::now()` with clock injection | Mechanical, ~15–20 sites |
| `reebe-wasm` | New crate: InMemoryBackend + VirtualClock + wasm-bindgen exports | New |

The processors themselves (all 12) carry over **unchanged**. Their BPMN execution logic is already backend-agnostic by design.
