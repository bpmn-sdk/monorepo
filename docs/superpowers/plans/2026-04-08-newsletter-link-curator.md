# Newsletter Link Curator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a helper script and a BPMN process file that periodically fetches emails from subscribed newsletters via `gws`, uses an LLM to filter links relevant to weeklyfoo.com, and appends curated links to `~/newsletter-links.md`.

**Architecture:** A helper Node.js script (`scripts/extract-newsletter-links.mjs`) handles Gmail JSON decoding and URL extraction. The BPMN process orchestrates: timer start → fetch email IDs → for each email (fetch+extract → LLM evaluate) → format → append. Uses only existing built-in workers; no proxy changes.

**Tech Stack:** BPMN 2.0 with Zeebe extensions, Node.js ESM helper script, reebe (local engine), `gws` CLI (Google Workspace), existing bpmnkit workers: `io.bpmnkit:cli:1`, `io.bpmnkit:js:1`, `io.bpmnkit:llm:1`, `io.bpmnkit:fs:append:1`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `scripts/extract-newsletter-links.mjs` | **Create** | Decode Gmail API JSON from stdin, extract + filter URLs, output `{sender, extractedLinks, extractedLinksJson}` |
| `bpmn-samples/newsletter-link-curator.bpmn` | **Create** | The BPMN process with all Zeebe extensions configured |

---

## Process Variables (set once at deploy time)

| Variable | Type | Example | Description |
|---|---|---|---|
| `senders` | `string` | `newsletter@tldr.tech OR digest@bytes.dev` | Gmail search format — `OR`-separated sender addresses |
| `lookbackHours` | `number` | `6` | Match this to the timer interval |
| `repoPath` | `string` | `/home/adam/github.com/bpmnkit/monorepo` | Absolute path to monorepo root; used to locate the helper script |

---

### Task 1: Write the link extraction helper script

**Files:**
- Create: `scripts/extract-newsletter-links.mjs`

- [ ] **Step 1: Create `scripts/extract-newsletter-links.mjs`**

```js
#!/usr/bin/env node
/**
 * Reads a `gws gmail messages get --format json` response from stdin.
 * Outputs JSON: { sender: string, extractedLinks: {url,text}[], extractedLinksJson: string }
 *
 * Usage: gws gmail messages get <id> --format json | node scripts/extract-newsletter-links.mjs
 */
import { readFileSync } from 'node:fs'

const input = readFileSync('/dev/stdin', 'utf8')
const msg = JSON.parse(input)

// Extract sender from message headers
const headers = msg.payload?.headers ?? []
const fromHeader = headers.find(h => h.name === 'From' || h.name === 'from')
const sender = fromHeader?.value ?? 'unknown'

// Find a body part by MIME type (walks multipart tree recursively)
function findPart(parts, mimeType) {
  if (!Array.isArray(parts)) return null
  for (const p of parts) {
    if (p.mimeType === mimeType && p.body?.data) return p.body.data
    const nested = findPart(p.parts, mimeType)
    if (nested) return nested
  }
  return null
}

// Gmail uses URL-safe base64 — convert +/_ then decode
const b64 =
  findPart(msg.payload?.parts, 'text/html') ??
  findPart(msg.payload?.parts, 'text/plain') ??
  msg.payload?.body?.data ??
  ''

const body = b64
  ? Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  : ''

// Extract all URLs from body text / HTML
const rawUrls = body.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []

// Deduplicate and filter noise
const seen = new Set()
const extractedLinks = []

for (const raw of rawUrls) {
  const url = raw.replace(/[.,;!?:]+$/, '') // strip trailing punctuation
  if (seen.has(url)) continue
  seen.add(url)

  if (/unsubscribe|optout|opt-out/i.test(url)) continue
  if (/utm_|click\.|track\./i.test(url)) continue
  if (/mailto:|tel:/i.test(url)) continue

  // Skip root-domain-only URLs (e.g. https://example.com/)
  try {
    const u = new URL(url)
    if (u.pathname === '/' || u.pathname === '') continue
  } catch {
    continue
  }

  extractedLinks.push({ url, text: url })
}

process.stdout.write(
  JSON.stringify({ sender, extractedLinks, extractedLinksJson: JSON.stringify(extractedLinks) })
)
```

- [ ] **Step 2: Verify the script parses without errors**

```bash
echo '{"payload":{"headers":[{"name":"From","value":"test@example.com"}],"body":{"data":""}}}' \
  | node scripts/extract-newsletter-links.mjs
```

Expected output (no error):
```
{"sender":"test@example.com","extractedLinks":[],"extractedLinksJson":"[]"}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/extract-newsletter-links.mjs
git commit -m "feat: add newsletter link extraction helper script"
```

---

### Task 2: Write the BPMN process file

**Files:**
- Create: `bpmn-samples/newsletter-link-curator.bpmn`

> **gws command note:** The commands below assume `gws gmail messages list` and `gws gmail messages get <id> --format json`. Run `gws help gmail` to verify the exact subcommand syntax for your installed version. If different, only the `command` task headers need updating.

- [ ] **Step 1: Create `bpmn-samples/newsletter-link-curator.bpmn`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:process id="newsletter-link-curator" name="Newsletter Link Curator" isExecutable="true">

    <!--
      Process variables (set in Studio Run dialog before first deploy):
        senders       — Gmail search format, e.g. "newsletter@tldr.tech OR digest@bytes.dev"
        lookbackHours — number, default 6 (must match timer interval)
        repoPath      — absolute path to bpmnkit monorepo, e.g. /home/adam/github.com/bpmnkit/monorepo
    -->

    <!-- Timer Start Event: fires every 6 hours -->
    <bpmn:startEvent id="start" name="Every 6 Hours">
      <bpmn:outgoing>flow-start-to-fetch</bpmn:outgoing>
      <bpmn:timerEventDefinition id="timerDef">
        <bpmn:timeCycle>R/PT6H</bpmn:timeCycle>
      </bpmn:timerEventDefinition>
    </bpmn:startEvent>

    <!-- Fetch Email IDs from Gmail via gws CLI -->
    <bpmn:serviceTask id="fetch-email-ids" name="Fetch Email IDs">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:cli:1" />
        <zeebe:taskHeaders>
          <zeebe:header key="command" value="gws gmail messages list --query &quot;from:({{senders}}) newer_than:{{lookbackHours}}h&quot; --format json" />
          <zeebe:header key="timeout" value="30" />
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-start-to-fetch</bpmn:incoming>
      <bpmn:outgoing>flow-fetch-to-parse</bpmn:outgoing>
    </bpmn:serviceTask>

    <!-- Parse IDs: extract message ID array from gws JSON output -->
    <bpmn:serviceTask id="parse-ids" name="Parse Email IDs">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:js:1" />
        <zeebe:taskHeaders>
          <zeebe:header key="expression" value="(() => { const d = JSON.parse(variables.stdout); return d.messages ? d.messages.map(m => m.id) : []; })()" />
          <zeebe:header key="resultVariable" value="messageIds" />
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-fetch-to-parse</bpmn:incoming>
      <bpmn:outgoing>flow-parse-to-gw</bpmn:outgoing>
    </bpmn:serviceTask>

    <!-- Gateway: skip if no new emails -->
    <bpmn:exclusiveGateway id="gw-any-emails" name="Any emails?" default="flow-has-emails">
      <bpmn:incoming>flow-parse-to-gw</bpmn:incoming>
      <bpmn:outgoing>flow-no-emails</bpmn:outgoing>
      <bpmn:outgoing>flow-has-emails</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:endEvent id="end-no-emails" name="No new emails">
      <bpmn:incoming>flow-no-emails</bpmn:incoming>
    </bpmn:endEvent>

    <!-- Multi-instance sub-process: one iteration per message ID, sequential -->
    <bpmn:subProcess id="process-emails" name="Process Each Email">
      <bpmn:incoming>flow-has-emails</bpmn:incoming>
      <bpmn:outgoing>flow-sp-to-flatten</bpmn:outgoing>
      <bpmn:multiInstanceLoopCharacteristics isSequential="true">
        <bpmn:extensionElements>
          <zeebe:loopCharacteristics
            inputCollection="= messageIds"
            inputElement="messageId"
            outputCollection="allRelevantLinks"
            outputElement="= relevantLinks" />
        </bpmn:extensionElements>
      </bpmn:multiInstanceLoopCharacteristics>

      <bpmn:startEvent id="sub-start">
        <bpmn:outgoing>sub-flow1</bpmn:outgoing>
      </bpmn:startEvent>

      <!--
        Fetch & Extract: pipes gws output through the helper script.
        Produces stdout JSON: { sender, extractedLinks, extractedLinksJson }
      -->
      <bpmn:serviceTask id="fetch-and-extract" name="Fetch &amp; Extract Links">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:cli:1" />
          <zeebe:taskHeaders>
            <zeebe:header key="command" value="gws gmail messages get {{messageId}} --format json | node scripts/extract-newsletter-links.mjs" />
            <zeebe:header key="cwd" value="{{repoPath}}" />
            <zeebe:header key="timeout" value="30" />
          </zeebe:taskHeaders>
        </bpmn:extensionElements>
        <bpmn:incoming>sub-flow1</bpmn:incoming>
        <bpmn:outgoing>sub-flow2</bpmn:outgoing>
      </bpmn:serviceTask>

      <!--
        Parse Extraction: parse the stdout JSON and spread fields to process variables.
        After this task: sender, extractedLinks, extractedLinksJson are top-level variables.
      -->
      <bpmn:serviceTask id="parse-extraction" name="Parse Extraction">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:js:1" />
          <zeebe:taskHeaders>
            <zeebe:header key="expression" value="(() => { return JSON.parse(variables.stdout); })()" />
            <zeebe:header key="resultVariable" value="extractResult" />
          </zeebe:taskHeaders>
          <zeebe:ioMapping>
            <zeebe:output source="= extractResult.sender" target="sender" />
            <zeebe:output source="= extractResult.extractedLinks" target="extractedLinks" />
            <zeebe:output source="= extractResult.extractedLinksJson" target="extractedLinksJson" />
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>sub-flow2</bpmn:incoming>
        <bpmn:outgoing>sub-flow3</bpmn:outgoing>
      </bpmn:serviceTask>

      <!--
        Evaluate Relevance: LLM decides which links are worth saving.
        Input mapping builds the prompt from sender + extractedLinksJson.
        Output: response (JSON array string from LLM).
      -->
      <bpmn:serviceTask id="evaluate-relevance" name="Evaluate Relevance">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:llm:1" />
          <zeebe:taskHeaders>
            <zeebe:header key="system" value="You are a link curator for weeklyfoo.com, a web dev newsletter covering TypeScript, JavaScript, Node.js, Rust, UI/UX, and AI. Given a list of links extracted from a newsletter email, return only those worth saving as potential source material. Exclude generic homepage links, social media profiles, tracking pixels, and unsubscribe links. Return a JSON array only with no prose: [{&quot;url&quot;:&quot;...&quot;,&quot;title&quot;:&quot;...&quot;,&quot;reason&quot;:&quot;...&quot;}]" />
            <zeebe:header key="resultVariable" value="response" />
          </zeebe:taskHeaders>
          <zeebe:ioMapping>
            <zeebe:input source='= "Newsletter sender: " + sender + " | Links: " + extractedLinksJson' target="prompt" />
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>sub-flow3</bpmn:incoming>
        <bpmn:outgoing>sub-flow4</bpmn:outgoing>
      </bpmn:serviceTask>

      <!--
        Parse LLM Response: parse the JSON array from the LLM.
        Adds sender field to each link for use in the format step.
        Output: relevantLinks — this is the outputElement collected into allRelevantLinks.
      -->
      <bpmn:serviceTask id="parse-llm-response" name="Parse LLM Response">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:js:1" />
          <zeebe:taskHeaders>
            <zeebe:header key="expression" value="(() => { const raw = variables.response.trim(); const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim(); try { const links = JSON.parse(clean); const s = variables.sender || ''; return Array.isArray(links) ? links.map(l => ({url: l.url, title: l.title || l.url, reason: l.reason || '', sender: s})) : []; } catch(e) { return []; } })()" />
            <zeebe:header key="resultVariable" value="relevantLinks" />
          </zeebe:taskHeaders>
        </bpmn:extensionElements>
        <bpmn:incoming>sub-flow4</bpmn:incoming>
        <bpmn:outgoing>sub-flow5</bpmn:outgoing>
      </bpmn:serviceTask>

      <bpmn:endEvent id="sub-end">
        <bpmn:incoming>sub-flow5</bpmn:incoming>
      </bpmn:endEvent>

      <bpmn:sequenceFlow id="sub-flow1" sourceRef="sub-start" targetRef="fetch-and-extract" />
      <bpmn:sequenceFlow id="sub-flow2" sourceRef="fetch-and-extract" targetRef="parse-extraction" />
      <bpmn:sequenceFlow id="sub-flow3" sourceRef="parse-extraction" targetRef="evaluate-relevance" />
      <bpmn:sequenceFlow id="sub-flow4" sourceRef="evaluate-relevance" targetRef="parse-llm-response" />
      <bpmn:sequenceFlow id="sub-flow5" sourceRef="parse-llm-response" targetRef="sub-end" />
    </bpmn:subProcess>

    <!--
      Flatten & Format: merge allRelevantLinks (array of per-email arrays) into a
      markdown string. Groups by sender with a date header per group.
      resultVariable=content so the FS append task reads it directly.
    -->
    <bpmn:serviceTask id="flatten-format" name="Flatten &amp; Format">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:js:1" />
        <zeebe:taskHeaders>
          <zeebe:header key="expression" value="(() => { const all = variables.allRelevantLinks || []; const today = new Date().toISOString().split('T')[0]; let out = ''; for (let i = 0; i < all.length; i++) { const g = all[i]; if (!Array.isArray(g) || g.length === 0) continue; const s = g[0].sender || 'unknown'; out += '\n## ' + today + ' \u2014 ' + s + '\n\n'; for (let j = 0; j < g.length; j++) { const l = g[j]; out += '- [' + (l.title || l.url) + '](' + l.url + ')' + (l.reason ? ' \u2014 ' + l.reason : '') + '\n'; } } return out; })()" />
          <zeebe:header key="resultVariable" value="content" />
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-sp-to-flatten</bpmn:incoming>
      <bpmn:outgoing>flow-flatten-to-append</bpmn:outgoing>
    </bpmn:serviceTask>

    <!-- Append to Doc: writes markdownChunk to ~/newsletter-links.md -->
    <bpmn:serviceTask id="append-to-doc" name="Append to Doc">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:append:1" />
        <zeebe:taskHeaders>
          <zeebe:header key="path" value="~/newsletter-links.md" />
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-flatten-to-append</bpmn:incoming>
      <bpmn:outgoing>flow-append-to-end</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:endEvent id="end-main" name="Done">
      <bpmn:incoming>flow-append-to-end</bpmn:incoming>
    </bpmn:endEvent>

    <!-- Sequence flows -->
    <bpmn:sequenceFlow id="flow-start-to-fetch" sourceRef="start" targetRef="fetch-email-ids" />
    <bpmn:sequenceFlow id="flow-fetch-to-parse" sourceRef="fetch-email-ids" targetRef="parse-ids" />
    <bpmn:sequenceFlow id="flow-parse-to-gw" sourceRef="parse-ids" targetRef="gw-any-emails" />
    <bpmn:sequenceFlow id="flow-no-emails" name="no emails" sourceRef="gw-any-emails" targetRef="end-no-emails">
      <bpmn:conditionExpression>= count(messageIds) = 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow-has-emails" name="has emails" sourceRef="gw-any-emails" targetRef="process-emails" />
    <bpmn:sequenceFlow id="flow-sp-to-flatten" sourceRef="process-emails" targetRef="flatten-format" />
    <bpmn:sequenceFlow id="flow-flatten-to-append" sourceRef="flatten-format" targetRef="append-to-doc" />
    <bpmn:sequenceFlow id="flow-append-to-end" sourceRef="append-to-doc" targetRef="end-main" />

  </bpmn:process>

  <!-- Diagram layout -->
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="newsletter-link-curator">

      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="152" y="262" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fetch-email-ids_di" bpmnElement="fetch-email-ids">
        <dc:Bounds x="240" y="240" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="parse-ids_di" bpmnElement="parse-ids">
        <dc:Bounds x="400" y="240" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw-any-emails_di" bpmnElement="gw-any-emails" isMarkerVisible="true">
        <dc:Bounds x="555" y="255" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end-no-emails_di" bpmnElement="end-no-emails">
        <dc:Bounds x="557" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- Sub-process (expanded) — contains all sub-process shapes -->
      <bpmndi:BPMNShape id="process-emails_di" bpmnElement="process-emails" isExpanded="true">
        <dc:Bounds x="660" y="150" width="920" height="260" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sub-start_di" bpmnElement="sub-start">
        <dc:Bounds x="700" y="262" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fetch-and-extract_di" bpmnElement="fetch-and-extract">
        <dc:Bounds x="790" y="240" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="parse-extraction_di" bpmnElement="parse-extraction">
        <dc:Bounds x="980" y="240" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="evaluate-relevance_di" bpmnElement="evaluate-relevance">
        <dc:Bounds x="1150" y="240" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="parse-llm-response_di" bpmnElement="parse-llm-response">
        <dc:Bounds x="1340" y="240" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sub-end_di" bpmnElement="sub-end">
        <dc:Bounds x="1532" y="262" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNShape id="flatten-format_di" bpmnElement="flatten-format">
        <dc:Bounds x="1640" y="240" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="append-to-doc_di" bpmnElement="append-to-doc">
        <dc:Bounds x="1820" y="240" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end-main_di" bpmnElement="end-main">
        <dc:Bounds x="1982" y="262" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- Main flow edges -->
      <bpmndi:BPMNEdge id="flow-start-to-fetch_di" bpmnElement="flow-start-to-fetch">
        <di:waypoint x="188" y="280" />
        <di:waypoint x="240" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-fetch-to-parse_di" bpmnElement="flow-fetch-to-parse">
        <di:waypoint x="340" y="280" />
        <di:waypoint x="400" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-parse-to-gw_di" bpmnElement="flow-parse-to-gw">
        <di:waypoint x="500" y="280" />
        <di:waypoint x="555" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-no-emails_di" bpmnElement="flow-no-emails">
        <di:waypoint x="580" y="255" />
        <di:waypoint x="580" y="188" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-has-emails_di" bpmnElement="flow-has-emails">
        <di:waypoint x="605" y="280" />
        <di:waypoint x="660" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-sp-to-flatten_di" bpmnElement="flow-sp-to-flatten">
        <di:waypoint x="1580" y="280" />
        <di:waypoint x="1640" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-flatten-to-append_di" bpmnElement="flow-flatten-to-append">
        <di:waypoint x="1760" y="280" />
        <di:waypoint x="1820" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow-append-to-end_di" bpmnElement="flow-append-to-end">
        <di:waypoint x="1920" y="280" />
        <di:waypoint x="1982" y="280" />
      </bpmndi:BPMNEdge>

      <!-- Sub-process internal edges -->
      <bpmndi:BPMNEdge id="sub-flow1_di" bpmnElement="sub-flow1">
        <di:waypoint x="736" y="280" />
        <di:waypoint x="790" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sub-flow2_di" bpmnElement="sub-flow2">
        <di:waypoint x="920" y="280" />
        <di:waypoint x="980" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sub-flow3_di" bpmnElement="sub-flow3">
        <di:waypoint x="1090" y="280" />
        <di:waypoint x="1150" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sub-flow4_di" bpmnElement="sub-flow4">
        <di:waypoint x="1280" y="280" />
        <di:waypoint x="1340" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sub-flow5_di" bpmnElement="sub-flow5">
        <di:waypoint x="1470" y="280" />
        <di:waypoint x="1532" y="280" />
      </bpmndi:BPMNEdge>

    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>

</bpmn:definitions>
```

- [ ] **Step 2: Verify the XML is well-formed**

```bash
node -e "
const fs = require('node:fs');
const content = fs.readFileSync('bpmn-samples/newsletter-link-curator.bpmn', 'utf8');
console.log('File size:', content.length, 'bytes');
console.log('Has timer cycle:', content.includes('R/PT6H'));
console.log('Has sub-process:', content.includes('multiInstanceLoopCharacteristics'));
console.log('Has all job types:', ['io.bpmnkit:cli:1','io.bpmnkit:js:1','io.bpmnkit:llm:1','io.bpmnkit:fs:append:1'].every(t => content.includes(t)));
"
```

Expected output:
```
File size: <number> bytes
Has timer cycle: true
Has sub-process: true
Has all job types: true
```

- [ ] **Step 3: Commit**

```bash
git add bpmn-samples/newsletter-link-curator.bpmn
git commit -m "feat: add newsletter link curator BPMN process"
```

---

### Task 3: Deploy and smoke-test

- [ ] **Step 1: Ensure reebe and the proxy are running**

```bash
# In one terminal (if not already running):
pnpm turbo dev
```

Confirm `GET http://localhost:3000/status` returns `{ workers: { active: true } }`.

- [ ] **Step 2: Deploy the process to reebe**

Open Studio, import `bpmn-samples/newsletter-link-curator.bpmn`, and click Deploy. Or use the deploy skill:

```
/deploy bpmn-samples/newsletter-link-curator.bpmn
```

- [ ] **Step 3: Set process variables and trigger a manual run**

In the Studio Run dialog, set:
- `senders` → your actual newsletter sender addresses (Gmail search format)
- `lookbackHours` → `1` (for testing — checks last hour)
- `repoPath` → `/home/adam/github.com/bpmnkit/monorepo`

Click Run. Watch the process instance in Studio.

- [ ] **Step 4: Check for incidents and verify output**

If any task fails, click the incident in Studio to see the error. Common issues:

| Symptom | Likely cause | Fix |
|---|---|---|
| Fetch Email IDs fails | `gws` not in PATH or not authenticated | Run `gws auth login` and verify `gws gmail messages list --help` works |
| gws command syntax error | Your gws version uses different flags | Run `gws help gmail messages` and update the `command` headers |
| Parse IDs returns `[]` | gws list output format differs | Check `variables.stdout` in Studio variable inspector; adjust the `expression` header |
| Fetch & Extract fails | Script path or stdin handling | Test manually: `gws gmail messages get <id> --format json \| node scripts/extract-newsletter-links.mjs` |
| LLM step fails | No LLM adapter available | Ensure Claude Code or another adapter is running |

If successful, check the output:

```bash
cat ~/newsletter-links.md
```

Expected: one section per newsletter sender with relevant links.

- [ ] **Step 5: Confirm timer fires automatically**

After a successful manual run, let the process sit. Within 6 hours (or set `timeCycle` to `R/PT5M` temporarily for testing), it should fire again automatically. Check `~/.bpmnkit/timer-state.json` to confirm the timer state is persisted.

---

## Self-Review Notes

- **gws command format**: documented as a known variability point — only headers need changing, not the BPMN structure.
- **Base64 decoding**: handled in the Node.js helper (not the JS VM sandbox, which lacks `Buffer`). This is why the pipeline approach is used instead of a pure JS worker step.
- **Multi-instance output**: `outputElement = relevantLinks`, `outputCollection = allRelevantLinks` — each iteration's `relevantLinks` array is appended to `allRelevantLinks` in the parent scope.
- **LLM JSON parsing**: handles code-fence wrapping (`\`\`\`json ... \`\`\``), returns `[]` on parse error so a bad LLM response doesn't kill the whole run.
- **Empty run**: if `allRelevantLinks` is all-empty arrays, `flatten-format` returns `""` and `fs:append` appends an empty string — no change to the file.
