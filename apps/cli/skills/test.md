---
description: Analyse a BPMN process — check worker coverage and validation findings
---

@.claude/aikit.md

Analyse the BPMN process at the given path.

## File to test

$ARGUMENTS

---

1. Call `mcp__bpmnkit-aikit__bpmn_read` to understand the process structure (elements, service tasks, gateways, event types).

2. Call `mcp__bpmnkit-aikit__bpmn_simulate` with the path and an empty scenarios array to get worker coverage and validation analysis.

3. Call `mcp__bpmnkit-aikit__worker_list` to show the full worker catalog.

4. Present the results:

**Process structure**
- Pools / participants
- Service tasks and their job types
- Decision gateways and branch conditions
- Event types (timer, message, error, escalation)

**Worker coverage**
- ✓ Covered job types (matched to built-in or scaffolded workers)
- ✗ Missing job types (no worker found — scaffold with worker_scaffold)

**Validation findings**
- Errors and warnings from the pattern advisor

**Suggested test scenarios** (derived from the BPMN structure)
- Happy path: <describe the main success path>
- Edge cases: <describe key branches, timeouts, error conditions>
