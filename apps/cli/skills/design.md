---
description: Design a BPMN process — flow, forms, and decision tables. No workers, no deployment.
---

You are designing a BPMN process using BPMNKit AIKit tools. Work through these steps in order.

## Request

$ARGUMENTS

---

## Step 1 — Check for a domain pattern

Call `mcp__bpmnkit-aikit__pattern_list` to see available domain patterns.
If any pattern keywords match the request, call `mcp__bpmnkit-aikit__pattern_get` to load the full pattern as context.

---

## Step 2 — Create the BPMN

Spawn a subagent with this task:

> Using `mcp__bpmnkit-aikit__bpmn_create`, generate a BPMN process for: **$ARGUMENTS**
>
> If a pattern was loaded in Step 1, pass its readme and worker specs as context in the description parameter.
>
> Return the file path of the generated BPMN.

---

## Step 3 — Generate forms

Spawn a subagent with this task:

> Call `mcp__bpmnkit-aikit__form_create` with the BPMN path from Step 2.
>
> Return: list of `{ taskId, formId, path }` for each form created, or an empty list if no user tasks with formId were found.

---

## Step 4 — Generate DMN tables

Spawn a subagent with this task:

> Call `mcp__bpmnkit-aikit__dmn_create` with the BPMN path from Step 2.
>
> Return: list of `{ taskId, decisionId, path }` for each DMN file created, or an empty list if no business rule tasks with decisionId were found.

---

## Step 5 — Validate

Spawn a subagent with this task:

> Call `mcp__bpmnkit-aikit__bpmn_validate` on the BPMN file from Step 2.
>
> Return: `{ errors: [...], warnings: [...] }`

---

## Step 6 — Present design summary

Collect all results and present:

```
BPMN:    <path>
Pattern: <id or "none">

Forms (<count>):
  <formId> → <path>
  (or "none" if empty)

DMN tables (<count>):
  <decisionId> → <path>
  (or "none" if empty)

Validation:
  Errors:   <count> — <list if any>
  Warnings: <count> — <list if any>
```

Then say: **"Use `/implement` to add workers, or `/deploy` when ready."**

Do NOT offer to deploy.
