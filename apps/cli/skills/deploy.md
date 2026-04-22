---
description: Deploy a BPMN process to local reebe or Camunda 8
---

@.claude/aikit.md

Deploy the BPMN process at the given path.

## File to deploy

$ARGUMENTS

---

1. Call `mcp__bpmnkit-aikit__bpmn_validate` on the file to check for errors before deploying.
   - If there are errors, show them and ask: **"Fix errors first or deploy anyway?"**
   - If warnings only: show them but proceed.

2. Ask: **"Deploy to local reebe or Camunda 8?"**

3. Call `mcp__bpmnkit-aikit__bpmn_deploy` with the chosen target:
   - `"local"` — deploys to the local reebe instance at ZEEBE_ADDRESS
   - `"camunda8"` — deploys using the active casen profile (run `casen profile create` if not set up)

4. Report the result:
   - On success: "Deployed successfully. Process ID: <id>"
   - On failure: show the error and suggest a fix (profile not set up, reebe not running, etc.)

5. If any scaffolded workers exist in ./workers/, remind:
   ```
   Don't forget to start your workers:
     casen worker start
   ```
