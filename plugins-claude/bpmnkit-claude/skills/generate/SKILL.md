---
name: generate
description: Generate a BPMN process diagram from a natural language description. Creates a .bpmn file and shows an ASCII preview. Usage: /bpmnkit:generate <description>
---

Generate a BPMN process from this description: $ARGUMENTS

Steps:
1. Call the `bpmn_create` MCP tool with the description as input. It returns BPMN XML.
2. Derive a filename: lowercase the first 4 significant words of the description, join with hyphens, append `.bpmn`. Example: "order fulfillment process" → `order-fulfillment-process.bpmn`.
3. Write the XML to `<filename>.bpmn` in the current directory using the Write tool.
4. Run `casen lint lint <filename>.bpmn` via Bash and show the output so the user can see the process elements and any initial findings.
5. Print a summary: filename, number of elements, list of service task job types (if any).

If `bpmn_create` is not available (MCP not connected), tell the user to run `casen proxy start` first, then retry.
