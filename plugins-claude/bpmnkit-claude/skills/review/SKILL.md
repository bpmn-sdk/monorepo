---
name: review
description: Run static analysis on a BPMN file — pattern checks, variable flow, optimizer findings. Shows findings grouped by severity. Usage: /bpmnkit:review [file.bpmn]
---

Review the BPMN file for issues: $ARGUMENTS

Steps:
1. Determine the target file:
   - If $ARGUMENTS contains a filename ending in `.bpmn`, use that.
   - Otherwise, run `ls *.bpmn 2>/dev/null` in the current directory. If exactly one `.bpmn` file exists, use it. If multiple exist, list them and ask the user to specify.
2. Read the file with the Read tool.
3. Call the `bpmn_validate` MCP tool with the XML content.
4. Format and display findings grouped by severity:

   **Errors** (must fix before deploy)
   - [element-id] Description. Fix: hint.

   **Warnings** (should fix)
   - [element-id] Description. Fix: hint.

   **Info** (consider)
   - [element-id] Description.

5. If zero findings: print "No issues found. Process looks good."
6. Print a summary line: "X errors, Y warnings, Z info"
