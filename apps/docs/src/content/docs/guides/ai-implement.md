---
title: AI-Driven Implementation
description: Use the /implement skill to go from a natural language description to a deployed, tested BPMN process.
---

The `/implement` skill turns a plain-English description into a deployed, working process.
Claude plans the BPMN, wires workers, validates the result, checks coverage, and asks once
before deploying.

## Prerequisites

- `casen` installed and `casen proxy` running
- `.claude/mcp.json` present in your project (created automatically by `casen skills install`)
- Claude Code active in your terminal or IDE

## Install the skills

```sh
casen skills install
```

This copies four slash commands into `.claude/commands/`:
`/implement`, `/review`, `/test`, `/deploy`.

## Basic usage

In Claude Code, type:

```
/implement an invoice approval process for accounts payable
```

Claude works through four steps automatically:

1. **Pattern lookup** — checks whether a domain pattern matches the request and loads it as context
2. **BPMN creation** — calls `bpmn_create` to generate the process diagram, writes it to disk
3. **Worker wiring** — matches each service task to an existing worker or scaffolds a new one
4. **Validation + coverage** — runs the pattern advisor and checks that all job types have a worker

At the end Claude presents a summary and asks where to deploy.

## What gets created

```
project/
  invoice-approval.bpmn         ← generated process diagram
  workers/
    validate-invoice/
      index.ts                  ← implement the handle() function here
      package.json
      tsconfig.json
      README.md
    check-duplicate/
      index.ts
      ...
```

## Domain patterns

Before creating the BPMN, Claude checks a built-in pattern library for a domain match.
Patterns provide a starting template and realistic worker specs for common business processes:

| Pattern | Domain |
|---|---|
| `invoice-approval` | Finance / accounts payable |
| `employee-onboarding` | HR |
| `supplier-contract-review` | Procurement / legal |
| `incident-response` | IT / ops |
| `loan-origination` | Financial services |
| `content-moderation` | Trust & safety |
| `order-fulfillment` | E-commerce / supply chain |

Patterns are hints — Claude adapts them or ignores them when the request doesn't match.

## Deploying

At the end of the flow Claude asks:

```
Deploy to local reebe, deploy to Camunda 8, or skip deployment?
```

- **Local reebe** — deploys to `ZEEBE_ADDRESS` (default `http://localhost:26500`).
  Start reebe first with `casen reebe`.
- **Camunda 8** — deploys using the active `casen` profile.
  Set one up with `casen profile add`.
- **Skip** — leaves the BPMN file on disk for manual review and deployment.

## Implementing workers

Each scaffolded worker has a `handle()` function to implement:

```typescript
// workers/validate-invoice/index.ts
async function handle(variables: Inputs): Promise<Outputs> {
  // TODO: implement invoice validation
  throw new Error("Not implemented")
}
```

Start a worker for development:

```sh
cd workers/validate-invoice
npm install
npm start
```

Or start all workers at once:

```sh
casen worker start
```

See [Standalone Workers](/guides/workers-standalone/) for deployment options.

## Re-running and refining

You can call `/implement` multiple times. Existing workers are reused — only missing job
types get scaffolded.

To modify the BPMN after generation:

```
/implement add a timeout boundary event to the approval task in invoice-approval.bpmn
```

Or open the file in Studio for visual editing and run `/review` afterward.
