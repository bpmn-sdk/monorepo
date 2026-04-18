---
name: test
description: Run scenario tests on a BPMN process file and report path coverage. Usage: /bpmnkit:test [file.bpmn]
---

Run scenario tests: $ARGUMENTS

Steps:
1. Determine target file: extract `.bpmn` filename from $ARGUMENTS, or find the single `.bpmn` in cwd, or ask.
2. Run via Bash: `casen test <file.bpmn>`
3. Parse and display results:

   **Scenario Results**
   | Scenario | Result | Path |
   |----------|--------|------|
   | happy-path | ✓ PASS | start → validate → fulfill → end |
   | error-path | ✗ FAIL | start → validate → [missing handler] |

4. Show uncovered paths if any:
   ```
   Uncovered paths:
   - Gateway "check-stock" → branch "out-of-stock" has no test scenario
   ```
5. Summary: "X/Y scenarios passed. Path coverage: Z%"
