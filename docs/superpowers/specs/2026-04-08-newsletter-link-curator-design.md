# Newsletter Link Curator — Design Spec

**Date:** 2026-04-08
**Status:** Approved

## Overview

A personal BPMN process (`newsletter-link-curator`) that runs periodically, fetches emails from subscribed newsletters via the Google Workspace CLI (`gws`), extracts links, uses an LLM to filter those relevant to weeklyfoo.com (web dev: TypeScript, JavaScript, Node.js, Rust, UI/UX, AI), and appends curated links to a local Markdown file.

Runs entirely on reebe (local BPMN engine) using existing bpmnkit built-in workers. No new worker code needed.

---

## Process Flow

```
Timer Start (R/PT6H)
  → Fetch Email IDs          [CLI: gws gmail messages list --query "from:({{senders}}) newer_than:{{lookbackHours}}h" --format json]
  → Parse IDs                [JS: parse stdout JSON → messageIds: string[]]
  → Any emails?              [Exclusive Gateway: count(messageIds) = 0 → End]
  → For each email           [Multi-instance sub-process, sequential, collection=messageIds, elementVar=messageId, outputElement=relevantLinks, outputCollection=allRelevantLinks]
      → Fetch Message        [CLI: gws gmail messages get {{messageId}} --format json → messageBody: string]
      → Extract Links        [JS: decode body, extract sender + URLs, filter noise → sender: string, extractedLinks: {url,text}[]]
      → Evaluate Relevance   [LLM: given sender + JSON.stringify(extractedLinks) → relevantLinks: {url,title,reason}[]]
  → Flatten & Format         [JS: merge allRelevantLinks (array of arrays) → markdownChunk: string]
  → Append to Doc            [FS append: ~/newsletter-links.md]
  → End
```

---

## Process Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `senders` | `string` | (required) | Space-separated sender email addresses used in the gws query |
| `lookbackHours` | `number` | `6` | How far back to look; should match the timer interval |

Set once via the Studio "Run" dialog or hardcoded as default values in the start event's output mapping.

---

## Data Shape Per Step

| Step | Output variables |
|---|---|
| Fetch Email IDs | `stdout` (raw JSON string from gws) |
| Parse IDs | `messageIds: string[]` |
| Fetch Message | `messageBody: string` (raw JSON from gws) |
| Extract Links | `sender: string`, `extractedLinks: {url: string, text: string}[]` |
| Evaluate Relevance | `relevantLinks: {url: string, title: string, reason: string}[]` — collected into parent `allRelevantLinks` |
| Flatten & Format | `markdownChunk: string` |

The LLM prompt receives `JSON.stringify(extractedLinks)` as `extractedLinksJson` — the JS extract step outputs `extractedLinks` (array) and the LLM task header interpolation serializes it inline via a FEEL expression.

---

## LLM Configuration

**System header:**
> You are a link curator for weeklyfoo.com, a web dev newsletter covering TypeScript, JavaScript, Node.js, Rust, UI/UX, and AI. Given a list of links extracted from a newsletter email, return only those worth saving as potential source material. Exclude generic homepage links, social media profiles, tracking pixels, and unsubscribe links. Return JSON array: `[{"url":"...","title":"...","reason":"..."}]`

**Variable `prompt`** (interpolated at runtime):
```
Newsletter sender: {{sender}}
Links:
{{extractedLinksJson}}
```

`extractedLinksJson` is produced by the Extract Links JS step as `JSON.stringify(extractedLinks)` and stored as a string variable before the LLM task runs.

**Link noise filter** applied in the Extract Links JS step — strip URLs that:
- Contain `unsubscribe`, `optout`, `opt-out`
- Contain tracking params (`utm_`, `click.`, `track.`)
- Are the root domain only (e.g. `https://example.com/`)
- Are `mailto:` or `tel:` schemes

---

## Output Format

Appended to `~/newsletter-links.md` each run:

```markdown
## 2026-04-08 — newsletter@example.com

- [Why TypeScript 6 changes everything](https://...) — covers new TS features
- [Node.js streams guide](https://...) — deep dive relevant to backend series

```

---

## Worker Mapping

| BPMN Element | Worker type | Key config |
|---|---|---|
| Timer start | (built-in) | `timeCycle: R/PT6H` |
| Fetch Email IDs | `io.bpmnkit:cli:1` | `command: gws gmail messages list ...` |
| Parse IDs | `io.bpmnkit:js:1` | JS expression parsing stdout JSON |
| Any emails? | Exclusive gateway | FEEL: `= count(messageIds) = 0` |
| Multi-instance sub-process | Sequential | collection: `= messageIds`, elementVariable: `messageId` |
| Fetch Message | `io.bpmnkit:cli:1` | `command: gws gmail messages get {{messageId}} --format json` |
| Extract Links | `io.bpmnkit:js:1` | Decode body, extract `sender` + `extractedLinks` + `extractedLinksJson`, filter noise |
| Evaluate Relevance | `io.bpmnkit:llm:1` | System prompt + `prompt` var using `{{sender}}` and `{{extractedLinksJson}}` |
| Flatten & Format | `io.bpmnkit:js:1` | Merge per-email arrays, format as markdown |
| Append to Doc | `io.bpmnkit:fs:append:1` | path: `~/newsletter-links.md` |

---

## Deduplication

Uses `newer_than:Xh` in the gws query, where `X` matches `lookbackHours`. Simple and sufficient for low-volume newsletter email. No state file needed.

---

## Assumptions

- `gws` is installed and authenticated on the machine running the bpmnkit proxy.
- The exact `gws` subcommand syntax (`gmail messages list`, `gmail messages get`) follows the [googleworkspace/cli](https://github.com/googleworkspace/cli) conventions. If the installed version differs, only the `command` task headers need updating.
- Gmail link extraction handles both `text/plain` and `text/html` parts; HTML takes priority.
- The LLM response is valid JSON; if parsing fails, that email's links are skipped (job fails → incident visible in Studio).

---

## Deliverable

A single BPMN file: `bpmn-samples/newsletter-link-curator.bpmn`

No proxy code changes. No new packages. Uses only existing built-in workers.
