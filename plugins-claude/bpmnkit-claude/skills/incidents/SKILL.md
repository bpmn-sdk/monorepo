---
name: incidents
description: List open incidents with element context and suggested actions. Usage: /bpmnkit:incidents [--process-id X]
---

List open incidents: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS: extract `--process-id <value>` if present.
2. Build command: `casen incident list --output json`
   - If `--process-id` given: append `--process-definition-key <value>`
3. Run via Bash and parse JSON.
4. Display as a table:

   | Incident ID | Process | Element | Error Type | Since | Action |
   |-------------|---------|---------|------------|-------|--------|
   | 4503... | order-process | validate-order | JOB_NO_RETRIES | 2h ago | Retry or fix worker |

5. Suggested action column logic:
   - `JOB_NO_RETRIES` → "Check worker logs, then: `casen job fail <key> --retries 3`"
   - `UNHANDLED_ERROR_EVENT` → "Add error boundary to element, redeploy"
   - `CONDITION_ERROR` → "Fix FEEL expression on outgoing flow"
   - Other → "Investigate: `casen process-instance get <instance-id>`"

6. If zero incidents: "No open incidents."
7. Summary: "X open incidents across Y processes."
