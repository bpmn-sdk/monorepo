---
name: ascii
description: Show the structure of a BPMN, DMN, or Form file — element list, lint findings, and process layout. Usage: /bpmnkit:ascii <file>
---

Show the structure of the file: $ARGUMENTS

Steps:
1. Extract the filename from $ARGUMENTS. If none, find the single `.bpmn`/`.dmn`/`.form` file in cwd (or ask).
2. Read the file with the Read tool and count elements (startEvents, tasks, gateways, endEvents).
3. Run via Bash: `casen lint lint <file>` to get element analysis and findings.
4. Display the output from step 3.
5. Print a one-line summary: "Structure: <N> elements — <list: e.g. 1 start, 3 tasks, 2 gateways, 2 ends>"

If the file is not found: "File not found: <filename>. Provide a path to a .bpmn, .dmn, or .form file."
