---
name: instances
description: List running process instances with optional filters. Usage: /bpmnkit:instances [process-id] [--active|--failed]
---

List process instances: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS:
   - Extract process ID if present (non-flag argument)
   - Extract `--active` or `--failed` flag if present
2. Build the casen command:
   - Base: `casen process-instance list --output json`
   - If process ID given: append `--process-definition-key <id>`
   - If `--failed`: append `--state ERROR`
   - If `--active`: append `--state ACTIVE`
3. Run via Bash and parse JSON output.
4. Display as a table:

   | Instance ID | Process | Status | Started | Variables |
   |-------------|---------|--------|---------|-----------|
   | 2251799... | order-process | ACTIVE | 2026-04-17 14:22 | orderId=123 |

5. If zero results: "No instances found matching the filter."
6. Show total count: "Showing X instances."
