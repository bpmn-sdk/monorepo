---
description: Review a BPMN file and report findings with severity and fix suggestions
---

@.claude/aikit.md

Review the BPMN file at the given path using BPMNKit's pattern advisor.

## File to review

$ARGUMENTS

---

1. Call `mcp__bpmnkit-aikit__bpmn_validate` on the path above.

2. Present findings grouped by severity:

**Errors** (block deployment or indicate broken process flow)
- For each error: element IDs, message, suggested fix

**Warnings** (best-practice violations, missing patterns)
- For each warning: element IDs, message, suggested fix

**Info** (improvement suggestions)
- For each info item: message

3. Show a summary:
```
Total: <n> findings — <errors> errors, <warnings> warnings, <info> info
Auto-fixable: <n>
```

4. If there are auto-fixable findings, ask: **"Apply auto-fixes?"**
   If yes, call `mcp__bpmnkit-aikit__bpmn_update` with instruction: "Apply all auto-fixable pattern advisor suggestions"
