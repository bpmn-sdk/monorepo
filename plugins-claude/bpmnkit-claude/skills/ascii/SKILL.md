---
name: ascii
description: Render a BPMN, DMN, or Form file as Unicode box-drawing ASCII art in the terminal. Usage: /bpmnkit:ascii <file>
---

Render as ASCII art: $ARGUMENTS

Steps:
1. Extract the filename from $ARGUMENTS. If none, find the single `.bpmn`/`.dmn`/`.form` file in cwd (or ask).
2. Run via Bash: `casen bpmn render <file>` (works for BPMN, DMN, and Form files).
3. Display the full ASCII output in a code block.
4. Print a one-line summary: "Rendered <filename> — <N> elements"

If the file is not found: "File not found: <filename>. Provide a path to a .bpmn, .dmn, or .form file."
