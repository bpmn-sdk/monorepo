---
description: Implement a BPMN process end-to-end from a natural language description
---

@.claude/aikit.md

You are implementing a BPMN process end-to-end using BPMNKit AIKit tools. Work through these steps in order.

## Request

$ARGUMENTS

---

## Step 1 — Check for a domain pattern

Call `mcp__bpmnkit-aikit__pattern_list` to see available domain patterns.
If any pattern keywords match the request, call `mcp__bpmnkit-aikit__pattern_get` to load the full pattern as context for the next step.

---

## Step 2 — Plan: Create the BPMN

Spawn a subagent with this task:

> Using the MCP tool `mcp__bpmnkit-aikit__bpmn_create`, generate a BPMN process for: **$ARGUMENTS**
>
> If a domain pattern was loaded in Step 1, pass its readme and worker specs as additional context in the description parameter.
>
> Return the file path of the generated BPMN.

---

## Step 3 — Implement: Wire workers

Spawn a subagent with this task:

> You are implementing workers for a BPMN process.
>
> 1. Call `mcp__bpmnkit-aikit__worker_list` to get the catalog of available workers.
> 2. Call `mcp__bpmnkit-aikit__bpmn_read` on the BPMN file from Step 2 to find all service task job types.
> 3. For each service task job type:
>    - If a built-in or previously scaffolded worker matches: note it as "reused"
>    - If no match exists: call `mcp__bpmnkit-aikit__worker_scaffold` with the job type, a description, and expected inputs/outputs derived from the BPMN context
> 4. Return: a list of `{ jobType, status: "reused" | "scaffolded", workerPath? }` for each service task

---

## Step 4 — Review: Validate the BPMN

Spawn a subagent with this task:

> Call `mcp__bpmnkit-aikit__bpmn_validate` on the BPMN file from Step 2.
> Identify any errors that block deployment and any warnings worth noting.
> Return: `{ errors: [...], warnings: [...] }`

---

## Step 5 — Test: Check coverage

Spawn a subagent with this task:

> Call `mcp__bpmnkit-aikit__bpmn_simulate` on the BPMN file from Step 2 with an empty scenarios array.
> Return: worker coverage report (total service tasks, covered, missing)

---

## Step 6 — Present summary and ask to deploy

Collect all results and present a summary:

```
BPMN file: <path>
Pattern used: <id or "none">

Workers:
  ✓ reused:     <list>
  + scaffolded: <list with paths>

Validation:
  Errors:   <count> — <list if any>
  Warnings: <count> — <list if any>

Worker coverage: <covered>/<total> service tasks

Scaffolded workers require: npm install && npm start (in each workers/<name>/ directory)
```

Then ask: **"Deploy to local reebe, deploy to Camunda 8, or skip deployment?"**

- If "local": call `mcp__bpmnkit-aikit__bpmn_deploy` with `target: "local"`
- If "camunda8": call `mcp__bpmnkit-aikit__bpmn_deploy` with `target: "camunda8"`
- If "skip": done
