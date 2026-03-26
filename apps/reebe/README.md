# Reebe

A drop-in REST API replacement for [Zeebe](https://zeebe.io/) (Camunda 8 process engine), written in Rust.
Compatible with the Camunda 8 REST API v2.

## What is Reebe?

Reebe is a BPMN workflow engine that implements the Camunda 8 REST API (`/v2/*`) in Rust.
It is designed as a direct replacement for the Zeebe broker — any HTTP client or SDK that targets
the Camunda 8 REST API works unchanged against Reebe.

Reebe uses PostgreSQL as its sole storage backend, replacing both RocksDB (the Zeebe journal) and
Elasticsearch (the query side). The same append-only event log model that gives Zeebe its
correctness guarantees is preserved, but implemented entirely in SQL.

## Why Reebe?

| Property | Zeebe (Java) | Reebe (Rust) |
|---|---|---|
| Memory usage | 1–2 GB (JVM heap) | ~50 MB |
| Startup time | 15–30 s | < 1 s |
| GC pauses | Yes (stop-the-world) | None |
| Storage backends | RocksDB + Elasticsearch | PostgreSQL only |
| Deployment | Multi-JAR + Elasticsearch cluster | Single binary |
| gRPC API | Yes | No (REST only) |

Reebe is ideal for development environments, resource-constrained deployments, and any situation
where running a full Camunda 8 stack is impractical.

---

## Quick Start

### Option 1: Embedded SQLite (fastest, no dependencies)

```bash
git clone https://github.com/urbanisierung/reebe
cd reebe
just dev-embedded
```

Starts Reebe with a built-in SQLite database — no Docker or PostgreSQL needed.

### Option 2: Docker Compose (PostgreSQL)

```bash
git clone https://github.com/urbanisierung/reebe
cd reebe
docker-compose up
```

The API is available at `http://localhost:8080/v2/`.

### Option 3: Binary with PostgreSQL

```bash
# Build from source
cargo build --release -p reebe-server

# Start PostgreSQL (or provide your own)
docker run -d --name reebe-pg \
  -e POSTGRES_DB=reebe -e POSTGRES_USER=reebe -e POSTGRES_PASSWORD=reebe \
  -p 5432:5432 postgres:16-alpine

# Run Reebe
REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe \
  ./target/release/reebe-server
```

---

## Requirements

- **PostgreSQL 15+** — required only when using the default backend
- **Rust 1.80+** — required only when building from source
- No external dependencies when using `--features embedded` (SQLite is built in)

---

## Installation

### Docker Compose (easiest)

```bash
docker-compose up
```

This starts PostgreSQL and Reebe together. Data is persisted in a named Docker volume.

### Build from source

```bash
cargo build --release -p reebe-server
# Binary is at ./target/release/reebe
```

### Download binary

Pre-built binaries will be available in future releases.

---

## Configuration

Reebe is configured via a TOML file (default: `config.toml`) with environment variable overrides.

### Full config.toml reference

```toml
[server]
# Interface to bind to
host = "0.0.0.0"
# Port for the REST API (Camunda 8 compatible at /v2/*)
port = 8080

[database]
# PostgreSQL connection URL
url = "postgres://reebe:reebe@localhost:5432/reebe"
# Maximum connections in the pool
max_connections = 20
# Minimum connections kept alive
min_connections = 2
# Seconds to wait before failing a connection attempt
connection_timeout_secs = 30

[engine]
# Number of partitions (for future clustering)
partition_count = 1
# Node ID (for future clustering)
node_id = 0
# Maximum records processed per batch
max_batch_size = 100
# How often to check for due timers (milliseconds)
timer_check_interval_ms = 100
# How often to check for timed-out jobs (milliseconds)
job_timeout_check_interval_ms = 1000

[jobs]
# Default long-poll timeout for job activation (milliseconds)
default_poll_timeout_ms = 30000
# Maximum allowed activation timeout (milliseconds)
max_activation_timeout_ms = 600000

[logging]
# Log level: trace, debug, info, warn, error
level = "info"
# Format: "json" or "text"
format = "text"
```

### Environment variable overrides

Configuration keys map to environment variables with the `REEBE_` prefix and `__` as the
section separator:

```
REEBE_DATABASE__URL=postgres://...
REEBE_SERVER__PORT=8080
RUST_LOG=reebe=info
```

See `.env.example` for a full list.

---

## API Compatibility

Reebe implements the Camunda 8 REST API v2. Endpoints are available at:

```
http://localhost:8080/v2/*
```

### API Examples

#### Deploy a process

```bash
curl -X POST http://localhost:8080/v2/deployments \
  -F "resources=@process.bpmn"
```

#### Create a process instance

```bash
curl -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "my-process",
    "version": -1,
    "variables": {"orderId": "123"}
  }'
```

#### Activate jobs

```bash
curl -X POST http://localhost:8080/v2/jobs/activation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "my-job-type",
    "maxJobsToActivate": 10,
    "worker": "my-worker",
    "timeout": 60000
  }'
```

#### Complete a job

```bash
curl -X POST http://localhost:8080/v2/jobs/{key}/completion \
  -H "Content-Type: application/json" \
  -d '{"variables": {"result": "ok"}}'
```

#### Publish a message

```bash
curl -X POST http://localhost:8080/v2/messages/publication \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-received",
    "correlationKey": "order-123",
    "variables": {"amount": 99.99}
  }'
```

#### Broadcast a signal

```bash
curl -X POST http://localhost:8080/v2/signals/broadcast \
  -H "Content-Type: application/json" \
  -d '{"signalName": "shutdown", "variables": {}}'
```

#### Search process instances

```bash
curl -X POST http://localhost:8080/v2/process-instances/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"state": "ACTIVE"},
    "page": {"limit": 20}
  }'
```

#### Get topology

```bash
curl http://localhost:8080/v2/topology
```

---

## Architecture

Reebe is a Cargo workspace with the following crates:

| Crate | Description |
|---|---|
| `reebe-protocol` | Shared domain types, record types, intents, and value types |
| `reebe-feel` | FEEL (Friendly Enough Expression Language) evaluator |
| `reebe-bpmn` | BPMN 2.0 XML parser and process model types |
| `reebe-dmn` | DMN decision table parser and evaluator |
| `reebe-db` | PostgreSQL connection pool, migrations, and state repositories |
| `reebe-engine` | Event-sourcing stream processor, command gateway, and scheduler |
| `reebe-api` | Axum HTTP handlers, DTOs, and routing for all `/v2/*` endpoints |
| `reebe-server` | Binary entry point: CLI parsing, configuration, and startup |

### Processing model

Each command (e.g. `CREATE_PROCESS_INSTANCE`) is written to an append-only `partition_records`
table in PostgreSQL. A single-threaded processing loop reads commands in order, runs the
appropriate processor, and writes resulting events plus updated state projections — all in one
database transaction. This is the same event-sourcing model used by Zeebe, re-implemented in
Rust on top of PostgreSQL.

---

## Development

### Running tests

```bash
cargo test --workspace
```

### Running with Docker Compose

```bash
docker-compose up
```

### Running locally

Start PostgreSQL first, then:

```bash
RUST_LOG=info cargo run -p reebe-server
```

Or with a config file:

```bash
RUST_LOG=info cargo run -p reebe-server -- --config config.example.toml
```

### Using the justfile

If you have [just](https://github.com/casey/just) installed:

```bash
just            # list all available commands
```

| Command | Description |
|---|---|
| `just dev` | Run in development mode (PostgreSQL required, verbose logging) |
| `just dev-fresh` | Flush the database and start from scratch (drops + recreates the volume) |
| `just dev-embedded` | Run with built-in SQLite — no external database needed |
| `just build` | Build a release binary |
| `just test` | Run all tests |
| `just test-verbose` | Run tests with stdout/stderr shown |
| `just check` | Check for compilation errors across the workspace |
| `just fmt` | Format all code with `rustfmt` |
| `just lint` | Run `clippy` with `-D warnings` |
| `just db-up` | Start only PostgreSQL via docker-compose |
| `just db-down` | Stop PostgreSQL (keeps the volume) |
| `just up` | Start the full stack (PostgreSQL + server) via docker-compose |
| `just down` | Stop everything and remove the data volume |
| `just bench [--count N] [--concurrency N]` | Run the throughput benchmark against a running server |

#### Embedded mode (no external database)

```bash
just dev-embedded
```

Builds and starts Reebe with a built-in SQLite database stored in the OS application-data
directory (`~/.local/share/reebe/reebe.db` on Linux, `~/Library/Application Support/reebe/reebe.db`
on macOS). No Docker, no PostgreSQL required — suitable for quick experimentation.

#### Benchmark

```bash
# Start the server first, then:
just bench
just bench --count 5000 --concurrency 100
```

Reports PI/s (process instances per second), average latency, and error count.

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `REEBE_DATABASE__URL` | PostgreSQL connection URL | `postgres://zeebe:zeebe@localhost:5432/zeebe` |
| `REEBE_SERVER__PORT` | HTTP port | `8080` |
| `RUST_LOG` | Log filter (see `tracing-subscriber`) | `reebe=info` |

---

## Compatibility Notes

### What works

- Full Camunda 8 REST API v2 JSON schema compatibility
- Process deployment (BPMN 2.0 + Zeebe extensions)
- Process instance creation, cancellation, and search
- Job activation (including long polling), completion, failure, and error
- Message publication and correlation
- Signal broadcasting
- Timer events (boundary, intermediate, start)
- Variables (get, update, search)
- Incidents (search, resolve)
- User tasks
- Topology endpoint
- Multi-tenancy (basic)

### What is not supported

- **gRPC API** — excluded by design; use the REST API instead
- **Elasticsearch / OpenSearch exporters** — no exporter framework yet
- **Camunda web apps** (Operate, Tasklist, Optimize) — not included
- **Multi-node clustering (Raft)** — single-node only in current version
- **Java gRPC SDK** — use a REST-based client or the Camunda 8 Java REST client

---

## License

Apache 2.0 — see [LICENSE](./LICENSE) or https://www.apache.org/licenses/LICENSE-2.0
