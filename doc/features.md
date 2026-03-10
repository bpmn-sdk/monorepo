# Features

## DMN/Form layout, compact format, and MCP multi-type support (2026-03-10) — `packages/core`, `apps/ai-server`

- **DMN auto-layout**: `layoutDmn(defs)` assigns DMNDI positions to all DRG elements using a left-to-right layered layout based on the requirement DAG. Sizes: decision=180×80, inputData=125×45, knowledgeSource=100×63, BKM=160×80. Exposed as `Dmn.layout()`.
- **DMN benchmark**: `benchmarkDmnLayout(xml, fileName)` compares auto-layout vs reference DMNDI. Exported from `@bpmn-sdk/core`.
- **DMN compact format**: `compactifyDmn(defs) → CompactDmn` / `expandDmn(compact) → DmnDefinitions` — token-efficient AI format. Exposed as `Dmn.compactify()` / `Dmn.expand()`.
- **Form compact format**: `compactifyForm(def) → CompactForm` / `expandForm(compact) → FormDefinition`. Exposed as `Form.compactify()` / `Form.expand()`.
- **Form.makeEmpty()**: creates a minimal valid FormDefinition (analogous to `Bpmn.makeEmpty()` / `Dmn.makeEmpty()`).
- **MCP server multi-type**: `mcp-server.ts` now detects file type from content (BPMN/DMN/Form), exposes type-appropriate tool sets, and saves in the correct format. `compose_diagram` Bridge API works for all three types.
- **Bench script extended**: `scripts/bench-layout.mjs` processes `.bpmn`, `.dmn`, and `.form` files with type-specific reporting and summary.

## Auto-layout benchmark + compactness improvements (2026-03-10) — `packages/core`

- **`benchmarkLayout` API**: full pipeline to compare auto-generated positions against reference BPMN DI data — `benchmarkLayout`, `parseReferenceLayout`, `generateAutoLayout`, `compareLayouts`, `formatBenchmarkResult` exported from `@bpmn-sdk/core`.
- **Tighter spacing**: `GRID_CELL_WIDTH` reduced 200→130 (width ratio 1.51→1.0 vs bpmn.io reference), `GRID_CELL_HEIGHT` reduced 160→140 (140px parallel branch spacing matches bpmn.io).
- **Gateway labels below**: gateway labels now render centered below the diamond (standard BPMN convention).
- **`scripts/bench-layout.mjs`**: CLI benchmark script over any folder of `.bpmn` files; reports avg/p90/max distance, width/height ratio, order violations per file.
- **Reference BPMN samples**: `bpmn-samples/order-process.bpmn`, `bpmn-samples/parallel-approval.bpmn`.

## Layout + optimizer improvements (2026-03-09) — `packages/core`

- **Back-edge loop alignment**: `alignBranchBaselines` and `findBaselinePath` now correctly handle nodes with multiple successors caused by back-edge reversal, keeping sequential tasks on the main path aligned to the same center-y baseline.
- **`flow/multi-incoming-task` rule**: new optimizer rule detects non-gateway elements with more than 1 incoming flow and auto-fixes by inserting an exclusive gateway join.

## AI-assisted diagram design UX (2026-03-08) — `packages/editor`, `apps/landing`

- **New-diagram onboarding**: freshly-created diagrams show a full-coverage overlay instead of the canvas; three action cards let users choose "Start from scratch", "Generate example diagram", or "Ask AI"
- **Element-level Ask AI**: sparkle button in the contextual toolbar below any selected BPMN element; opens the AI chat panel with the element already in context
- `initEditorHud` returns `{ setActive, showOnboarding, hideOnboarding }` for lifecycle integration
- `HudOptions`: `onStartFromScratch`, `onGenerateExample`, `onAskAi` callbacks

## Camunda Admin API (SaaS) SDK + CLI (2026-03-06) — `packages/api`, `apps/cli`

Full support for the Camunda Console Admin API alongside the existing C8 REST API.

- **`AdminApiClient`** — generated from the SaaS Console swagger (`console.cloud.camunda.io`), same runtime as `CamundaClient` (OAuth2, retry, cache, typed events). Exported from `@bpmn-sdk/api`.
- **Admin API resources**: `MetaResource`, `MembersResource`, `ClustersResource`, `ActivityResource` — typed methods for every Admin API endpoint.
- **CLI command groups**: `casen meta`, `casen members`, `casen clusters`, `casen activity` — full list/get/create/delete/update support mirroring the C8 command structure.
- **Per-profile `apiType`**: each saved profile is tagged as `"c8"` (default) or `"admin"`. The CLI routes `getClient()` vs `getAdminClient()` accordingly.
- **`profile create --api-type admin`**: explicitly set the API type when creating a profile.
- **Auto-detect on `profile import`**: credentials files containing `CAMUNDA_CONSOLE_CLIENT_ID` or `CAMUNDA_CONSOLE_BASE_URL` are automatically classified as Admin API profiles; all others remain C8.
- **Admin env vars**: `CAMUNDA_CONSOLE_CLIENT_ID`, `CAMUNDA_CONSOLE_CLIENT_SECRET`, `CAMUNDA_OAUTH_URL`, `CAMUNDA_CONSOLE_BASE_URL`, `CAMUNDA_CONSOLE_OAUTH_AUDIENCE`.
- **Code generation**: `pnpm run generate:admin` in `packages/api`; tag derivation from URL path segments handles the tagless Admin API swagger.

## Process Runner Canvas Plugin (2026-03-03) — `canvas-plugins/process-runner`

Interactive BPMN execution toolbar embedded directly on the canvas.

- **Auto-play** — runs the entire process instance immediately with no configuration.
- **Play with JSON payload** — modal dialog lets you supply initial variables as a JSON object before executing.
- **Step-by-step** — starts in step mode; execution pauses after each element's I/O mapping. Click "→ Next" to advance one step at a time.
- **Stop** — cancels the running instance at any point.
- **Token-highlight integration** — pass `tokenHighlight: createTokenHighlightPlugin()` to see active/visited nodes and edges update in real-time.
- **Auto-deploy** — subscribes to `diagram:load`; automatically deploys the loaded diagram into the engine so the toolbar is always ready.
- **Structural typing** — depends only on `@bpmn-sdk/canvas`; engine and token-highlight are accepted via structural interfaces, no hard runtime coupling.

## Token Highlight Canvas Plugin (2026-03-03) — `canvas-plugins/token-highlight`

Visualizes live process execution state on the BPMN canvas when paired with `@bpmn-sdk/engine`.

- **Active elements** — amber glow pulse; marks nodes where a token is currently present.
- **Visited elements** — green tint; marks nodes the token has already left.
- **Active/visited edges** — colored and animated sequence flows; only highlights edges whose source has been visited, so untaken gateway branches stay neutral.
- **`trackInstance(instance)`** — one call auto-wires to any `ProcessInstance` via structural typing (no engine dependency required).
- **Manual API** — `setActive()`, `addVisited()`, `clear()` for custom control.

## BPMN Simulation Engine (2026-03-03) — `packages/engine` (`@bpmn-sdk/engine`)

Lightweight, zero-external-dependency BPMN simulation engine for browser and Node.js.

- **`Engine`** — Deploy BPMN/DMN/Form definitions; start process instances with optional input variables; register job workers by type.
- **`ProcessInstance`** — Token-based execution; `onChange(callback)` → real-time `ProcessEvent` stream; `cancel()`; `activeElements` / `state` / `variables_snapshot`.
- **Job workers** — Register handlers for service/user tasks. Auto-completes in simulation mode when no handler is registered.
- **Gateways** — Exclusive (condition eval), Parallel (split+join), Inclusive (all matching flows).
- **Timers** — ISO 8601 durations/dates/cycles via `setTimeout`.
- **DMN** — Business rule tasks evaluate decision tables via `@bpmn-sdk/feel`; supports all major hit policies.
- **Sub-processes** — Isolated child scope; completes when all tokens in sub-scope are consumed.
- **Error propagation** — Error end events propagate through scope chain to the nearest error boundary event.

## Native Rust AI server with embedded QuickJS (2026-03-03) — `apps/ai-server-rs`

The Tauri desktop app now bundles two native Rust binaries instead of a Node.js bundle:

- **`ai-server`** — HTTP server on port 3033 (axum, CORS, SSE). Detects and proxies Claude/Copilot/Gemini CLIs. Converts CompactDiagram ↔ BPMN XML via the embedded `@bpmn-sdk/core` bridge.
- **`bpmn-mcp`** — stdio MCP server (JSON-RPC 2.0). Used as the LLM's tool executor when MCP is supported. Maintains stateful BPMN diagram in-memory via the bridge.

**Core bridge** (`bridge.ts` → `bridge.bundle.js` → `include_str!`): `@bpmn-sdk/core` is compiled to an IIFE JS bundle at Rust build time and evaluated in a dedicated QuickJS (`rquickjs`) thread. When core changes, rebuilding the Rust package automatically picks up the update — no divergence between JS and Rust.

No Node.js required on the user's machine for the desktop app.

## History tab in sidebar dock (2026-03-03) — `canvas-plugins/history`, `packages/editor`

A dedicated "History" tab sits between Properties and AI in the right sidebar. It shows a chronological list of AI checkpoints for the currently open file with one-click restore (confirm dialog). The tab is disabled for in-memory files that have no storage context.

Day-based checkpoint retention: up to 50 checkpoints from today + 1 (latest) per day for the last 10 days. Older entries are pruned automatically on each save.

## MCP-based AI diagram editing (2026-03-03) — `apps/ai-server`

The AI server exposes a minimal stdio MCP server (`mcp-server.ts`) that gives the LLM structured tools to read and modify BPMN diagrams. Zero external dependencies — pure Node.js built-ins + `@bpmn-sdk/core`.

Tools: `get_diagram`, `add_elements`, `remove_elements`, `update_element`, `set_condition`, `add_http_call`, `replace_diagram`.

`add_http_call` always sets `jobType: "io.camunda:http-json:1"` — the Camunda HTTP REST connector is baked into the tool signature so the LLM can't use the wrong task type.

Adapters supported:
- **Claude** (`claude -p --mcp-config --allowedTools --strict-mcp-config`) — full MCP
- **Copilot** (`copilot -p --additional-mcp-config --allow-all-tools`, new `@github/copilot` GA Feb 2026) — full MCP
- **Gemini** (`gemini -p --yolo`) — fallback to system-prompt approach (no per-invocation MCP)

All diagram changes go through `expand()` + `Bpmn.export()` in core; the client receives validated XML via `{ type: "xml" }` SSE and never manipulates BPMN directly.

## Core-mediated AI pipeline (2026-03-03) — `apps/ai-server`

All AI chat requests now flow exclusively through the `@bpmn-sdk/core` package on the server:

1. **Operations format** — LLM outputs targeted ops (`add`, `remove`, `update`, `condition`) instead of re-generating the entire diagram for small changes. This is much more efficient for common tasks (add a node, rename, set a condition, add a REST connector task type).
2. **Fallback full diagram** — LLM can still output a full `CompactDiagram` for new diagrams or structural rewrites.
3. **Server-side validation** — `parseResponse()` applies ops to the current diagram, then `expand()` + `Bpmn.export()` validate and serialize the result. The frontend receives ready-made XML via a `{ type: "xml" }` SSE event.
4. **No client-side XML manipulation** — the apply button in the AI panel uses the server-produced XML directly.

## AI quick actions (2026-03-03) — `canvas-plugins/ai-bridge`

One-click AI operations on the current diagram, accessible via a quick-actions bar above the chat input:

- **Improve diagram** — analyzes the open diagram and returns an improved version in one shot, covering:
  - Sub-process consolidation (groups 3+ consecutive related tasks)
  - Simplification (removes redundant gateways and over-engineered paths)
  - Name normalization (verb-noun title case, consistent tone)
  - FEEL expression cleanup (minimal, readable conditions)
- Backend uses the core `optimize()` engine to pre-detect concrete issues (FEEL complexity, flow problems, task-reuse opportunities) before calling the LLM — the LLM receives a specific list of what to fix, not a generic "improve" instruction
- After streaming, the server validates the LLM's output by calling `expand()` + `Bpmn.export()` from core, then emits the result as a `{ type: "xml" }` SSE event — the client applies it directly without any client-side XML parsing
- The response appears as a normal AI message with an "Apply to diagram" button

## Tauri desktop app (2026-03-02) — `apps/desktop`

Native desktop application wrapping the BPMN SDK editor using Tauri v2:

- **Identical editor** to the browser version — same plugins, sidebar dock, AI integration
- **AI server auto-start** — on launch, spawns the bundled Node.js AI server automatically; no manual `pnpm ai-server` required
- **Small binary** — ~3–5 MB installer (vs 85+ MB Electron) via minimal Tauri features + release profile optimizations (`lto`, `opt-level = "s"`, `strip`)
- **Hot-reload dev** — `pnpm desktop:dev` opens a native window with Vite HMR
- **Cross-platform** — targets Linux/macOS/Windows via native OS WebView (WebKitGTK / WKWebView / Edge WebView2)
- **Placeholder icons** generated via `scripts/gen-icons.mjs`; replace with `pnpm tauri icon icon.png`

## Unified right sidebar dock (2026-03-02) — `apps/landing` + plugins

VS Code / Figma style dock that unifies the Properties config panel and the AI chat panel:

- **Single right dock** with Properties and AI tabs; no overlap, no z-index fighting
- **Properties tab**: shows config panel for selected element; "Select an element…" empty state when nothing selected
- **AI tab**: shows full AI chat panel (SSE streaming, Apply button, checkpoint history)
- **Collapse/expand**: width-based collapse (38px strip) — button always accessible; state persisted to `localStorage`
- **Resize**: left-edge drag; width 280–700px, persisted to `localStorage`
- **Auto-expand**: selecting an element expands dock to Properties tab; clicking AI button expands to AI tab
- **Backward compatible**: both plugins work without `container` (standalone/body mode unchanged)

## AI integration (2026-03-02) — `apps/ai-server` + `@bpmn-sdk/canvas-plugin-ai-bridge`

Local AI assistant for BPMN diagram creation and modification:

- **AI panel** in the editor (right-side slide-in) with streaming chat interface
- **Auto-apply**: AI responses containing a `CompactDiagram` JSON block get an "Apply to diagram" button; applies via `expand()` + auto-layout
- **Checkpoints**: IndexedDB stores up to 50 checkpoints per project/file; "History" button shows list with restore
- **Local server** (`pnpm ai-server`, port 3033): bridges browser to CLI-based AI — Claude CLI (`--output-format stream-json`) and GitHub Copilot CLI
- **Compact format** (`compactify`/`expand`): 5-10x token reduction vs raw XML; exported from `@bpmn-sdk/core`

## Reference navigation in element toolbar (2026-03-02) — `@bpmn-sdk/editor` HUD

When a BPMN element with a linked reference is selected, the cfg toolbar shows navigation buttons:

- **Call activity**: if `processId` set → "ProcessName ↗" navigate button; else → "Link process ▾" dropdown with available processes + "New process…" input modal
- **User task**: if `formId` set → "FormId ↗" navigate button; else → "Link form ▾" dropdown
- **Business rule task**: if `decisionId` set → "DecisionId ↗" navigate button; else → "Link decision ▾" dropdown
- Reference action buttons removed from config panel; process/form/decision text fields remain for manual editing

## Optimize plugin (2026-03-02) — `@bpmn-sdk/canvas-plugin-optimize`

New self-contained canvas plugin encapsulating the two-phase optimize dialog:

- `createOptimizePlugin(options)` returns `{ name, install(), button }` — button is injected into the HUD as `optimizeButton`
- Dialog logic (styles, phase 1 findings list, phase 2 results) fully self-contained in the plugin

## Custom storage dialogs (2026-03-02) — `@bpmn-sdk/canvas-plugin-storage`

All browser `prompt()`/`confirm()` calls replaced with themed custom modals:

- `showInputDialog(opts): Promise<string | null>` — text input modal with title, placeholder, default value
- `showConfirmDialog(opts): Promise<boolean>` — confirmation modal with optional `danger` styling
- Both exported from `@bpmn-sdk/canvas-plugin-storage`; used in storage and storage-tabs-bridge

## Optimize button (2026-03-02) — editor HUD + landing app

"Optimize Diagram" button in the BPMN editor action bar (wand+sparkle icon):

- **Phase 1** — shows all findings from `optimize(defs)` with severity badges; auto-fixable findings are pre-checked
- **Phase 2** — after applying selected fixes, shows results with "Open generated process in new tab" for extracted sub-processes
- Supports dark and light HUD themes
- Example diagram "Customer Notification Flow" on the welcome screen demonstrates 4 finding types

## `optimize()` — Static BPMN Optimization Analyzer (2026-03-02) — `@bpmn-sdk/core`

New `optimize(defs, options?)` function exported from `@bpmn-sdk/core`:

- **11 finding types** across 3 categories: `feel`, `flow`, `task-reuse`
- **FEEL analysis**: detects empty conditions, missing default flows, complex expressions (length/nesting/operators/variables), complex IO mappings, duplicate expressions
- **Flow analysis**: detects unreachable elements, dead-end nodes, missing end events, redundant gateways, empty sub-processes
- **Task reuse**: clusters service tasks by similarity (taskType + headers + IO) and flags groups that can be extracted to reusable call activities
- **`applyFix`** on each applicable finding mutates `defs` in-place; task reuse fix returns a generated `BpmnDefinitions` for the extracted sub-process
- **Configurable thresholds** via `OptimizeOptions`: FEEL length/nesting/operator/variable thresholds, reuse group minimum size, category filter

## Storage-tabs integration bridge (2026-03-02) — `@bpmn-sdk/canvas-plugin-storage-tabs-bridge`

New package that wires storage and tabs together so client apps don't need to manually manage the cross-plugin state:

- **`createStorageTabsBridge(options)`** — single factory that creates `tabsPlugin`, `storagePlugin`, and `bridgePlugin` pre-wired together
- **Tab↔file maps** — automatically tracks which tab corresponds to which storage file; handles project open/leave/rename
- **MRU tracking** — per-project most-recently-used file list; loaded on project open, updated on tab activate
- **File-search commands** — registers "Switch to file" and "Rename current file" commands in the command palette (when `palette` option provided)
- **Ctrl+E file switcher** — full keyboard-navigable switcher overlay; E to cycle, Tab/→ to search mode, Ctrl-release to commit
- **Auto-save** — wires `onTabChange` to `storageApi.scheduleSave` for DMN/Form tabs
- **Built-in download** — serializes BPMN/DMN/Form and triggers browser download (overridable)
- **Built-in recent projects** — maps `storageApi.getRecentProjects()` to welcome screen dropdown
- **`persistTheme`** on `BpmnEditor` — reads/writes `localStorage "bpmn-theme"` automatically
- **`enableFileImport`** on `createTabsPlugin` — built-in hidden file input + drag-and-drop; `api.openFilePicker()` to trigger programmatically
- **`Bpmn.makeEmpty()` / `Bpmn.SAMPLE_XML`** — convenience factories in `@bpmn-sdk/core`
- **`Dmn.makeEmpty()`** — returns minimal `DmnDefinitions` with one empty decision table

## DMN DRD Canvas (2026-03-01) — `@bpmn-sdk/canvas-plugin-dmn-editor` + `@bpmn-sdk/core`

- **Full DRG element model** — `DmnInputData`, `DmnKnowledgeSource`, `DmnBusinessKnowledgeModel`, `DmnTextAnnotation`, `DmnAssociation`, all three requirement types (`DmnInformationRequirement`, `DmnKnowledgeRequirement`, `DmnAuthorityRequirement`), waypoints, and diagram edges
- **Parser/serializer roundtrip** — all DRG elements, requirement child elements, and DMNDI edges (with `di:waypoint`) are parsed and serialized; `decisionTable` is now optional on decisions
- **Interactive SVG DRD canvas** — pan/zoom, drag-to-move nodes, connect mode, inline label editing, keyboard delete, auto-layout for nodes without diagram positions
- **5 node shapes**: Decision (rect), InputData (stadium), KnowledgeSource (wavy-bottom rect), BKM (clipped-corner rect), TextAnnotation (open bracket)
- **4 edge types**: InformationRequirement (solid filled arrow), KnowledgeRequirement (dashed open-V arrow), AuthorityRequirement (dashed + open circle), Association (dotted)
- **Toolbar**: add node buttons for each type, Connect tool, zoom controls
- **DRD as primary view** — opening a DMN file shows the DRD canvas; double-click a Decision → decision table; "← DRD" back button returns to DRD
- **Zero external dependencies** — pure TypeScript/DOM SVG rendering

## Form Editor drag-and-drop redesign (2026-02-28) — `@bpmn-sdk/canvas-plugin-form-editor`

- Three-panel layout: Palette (260px fixed) | Canvas (flex, scrollable) | Properties (300px fixed)
- **Palette**: 5 groups (Input, Selection, Presentation, Containers, Action); icon grid; live search; click or drag to add
- **Canvas**: card-based visual form preview; drop zones between cards; empty state; nested containers with inner drop zones
- **Drag-and-drop**: native HTML5 DnD; palette→canvas (copy), card→card (move); drop-zone highlight; self-move prevention
- **Component previews**: per-type non-interactive previews (faux input, textarea, select, checkbox, radio, button, badge, separator, spacer, image)
- **Properties panel**: colored icon header; label/key/required/text/expression/options inputs; label updates preview live without refocusing
- **CSS**: light theme by default; dark via `.dark` class; `--fe-*` CSS variables

## DMN Editor feature parity (2026-02-28) — `@bpmn-sdk/canvas-plugin-dmn-editor`

- Single-row column headers with "When"/"And" (inputs) and "Then"/"And" (outputs) clause labels
- Hit policy in table corner — abbreviated (U/F/A/P/C/C+/C</C>/C#/R/O); select overlay to change
- Collect aggregation: C, C+ (SUM), C< (MIN), C> (MAX), C# (COUNT)
- TypeRef dropdown per column — editable; round-trips through XML
- Annotations column bound to `rule.description`
- Context menu — right-click row number: add above/below/remove; right-click column header: add left/right/remove
- Double border separating input from output sections
- Light theme as default; dark theme via `.dark` class
- `DmnAggregation` type added to `@bpmn-sdk/core`; parsed and serialized in `aggregation` XML attribute

## DMN Editor + Form Editor (2026-02-27) — `@bpmn-sdk/canvas-plugin-dmn-editor` + `@bpmn-sdk/canvas-plugin-form-editor`

- **`@bpmn-sdk/canvas-plugin-dmn-editor`** — native editable decision table; zero external dependencies
  - **`DmnEditor`** class with `loadXML(xml)`, `getXML()`, `onChange(handler)`, `destroy()` API
  - Parses XML via `Dmn.parse`; serializes on demand via `Dmn.export`; model kept in memory
  - Editable decision name + hit policy dropdown per decision
  - Add / remove input columns, output columns, and rules (rows)
  - Each cell is a `<textarea>` bound directly to the model; structural changes trigger full re-render from model
  - CSS injected via `injectDmnEditorStyles()` — `--dme-*` CSS variables; dark default / `.light` override pattern

- **`@bpmn-sdk/canvas-plugin-form-editor`** — native two-panel form component editor; zero external dependencies
  - **`FormEditor`** class with `loadSchema(schema)`, `getSchema()`, `onChange(handler)`, `destroy()` API
  - Parses schema via `Form.parse`; exports via `Form.export`
  - Left panel: component list with type badge, label, up/down reorder, delete; nested containers shown indented
  - Right panel: property editor for selected component (label, key, required, options list, etc.)
  - "Add" dropdown grouped by Fields / Display / Advanced / Layout; all standard form component types supported
  - CSS injected via `injectFormEditorStyles()` — `--fe-*` CSS variables; dark default / `.light` override pattern

- **Tabs plugin wired for editing** — `@bpmn-sdk/canvas-plugin-tabs` mounts `DmnEditor` / `FormEditor`; `tab.config` kept in sync on every change
  - **`onTabChange(tabId, config)`** callback — fires whenever a DMN or Form tab's content changes; used for auto-save
  - Cleanup on tab close / `destroy()`

- **Auto-save wired in landing app** — `onTabChange` triggers `storagePlugin.api.scheduleSave()` for DMN and Form tabs

## IndexedDB Storage Plugin (2026-02-26, overhauled 2026-02-27) — `@bpmn-sdk/canvas-plugin-storage`

- **`@bpmn-sdk/canvas-plugin-storage`** — persists BPMN / DMN / Form files in the browser's IndexedDB in a `workspace → project → files` hierarchy
  - **Native IndexedDB** — zero-dependency wrapper; supports `get/add/update/delete`, `orderBy`, `where().equals()` with `toArray/sortBy/delete`, and `filter`
  - **6 record types**: `WorkspaceRecord`, `ProjectRecord`, `FileRecord` (with `isShared` and `gitPath`), `FileContentRecord`, `ProjectMruRecord` (per-project Ctrl+Tab history)
  - **Auto-save** — 500 ms debounce triggered by `diagram:change`; forced flush on page hide / `beforeunload`; multi-tab safe; bumps project `updatedAt` on each save
  - **Main-menu integration** — workspace/project navigation via drill-down menu (no sidebar); "Open Project", "Save All to Project", "Leave Project" actions in the ⋮ menu
  - **Welcome screen on load** — always shows welcome screen on startup; no auto-restore; `getRecentProjects()` provides top-10 recently-saved projects for the welcome dropdown
  - **`onLeaveProject` callback** — called when "Leave" is clicked; wired to close all tabs and show the welcome screen
  - **Export project as ZIP** — "Export Project…" in the main menu downloads a `.zip` of all project files; built-in CRC-32 + ZIP STORE implementation, no external dependencies
  - **Shared files** — any file can be marked `isShared: true` to make it accessible for cross-workspace reference resolution
  - **GitHub-sync ready** — every `FileRecord` carries a `gitPath: string | null` field reserved for future bidirectional GitHub sync
  - **`createStoragePlugin(options)`** returns `CanvasPlugin & { api: StorageApi }`; requires `mainMenu` and `getOpenTabs` options
  - **Project mode** — when a project is open: tabs cannot be closed by the user; all project files are always open; "Rename current file…" appears in the main menu; `onRenameCurrentFile` callback updates the tab display name
  - **MRU per project** — `getMru(projectId)` / `pushMruFile(projectId, fileId)` persist the most-recently-used file order in IndexedDB; used for Ctrl+Tab switching

## Main Menu Plugin (enhanced 2026-02-26, restyled 2026-02-27) — `@bpmn-sdk/canvas-plugin-main-menu`

- **`MainMenuApi`** — programmatic API: `setTitle(text)` updates title span; `setDynamicItems(fn)` injects items on every open
- **`MenuDrill`** — drill-down menu items with back-navigation stack; clicking drills into sub-menu; "← Back" button returns to parent
- **`MenuInfo`** — passive info row with optional action button (e.g. "Leave" for active project indicator)
- Theme picker now behind a "Theme" drill item instead of flat in root dropdown
- **Integrated into tab bar** — panel is flush with the tab bar (right-anchored, 36px tall, matching dark/light background colors); auto-reserves 160px via CSS `:has()` so the tab labels are never hidden behind it

## BPMN Element Config — Event Types (2026-02-27) — `@bpmn-sdk/canvas-plugin-config-panel-bpmn`

- **Timer events** — timerStartEvent, timerCatchEvent, timer boundaryEvent: "Timer type" select (Cycle / Duration / Date) + FEEL expression field for the chosen type; writes `BpmnTimerEventDefinition`
- **Message events** — messageStartEvent, messageCatchEvent, messageEndEvent, messageThrowEvent, message boundaryEvent, receiveTask: "Message name" + "Correlation key" FEEL fields; writes `zeebe:message` extension element
- **Signal events** — signal start/catch/throw/end events and signal boundaryEvent: "Signal name" FEEL field; writes `zeebe:signal` extension element
- **Error events** — errorEndEvent and error boundaryEvent: "Error code" FEEL field; writes `zeebe:error` extension element
- **Escalation events** — escalation end/throw/catch events and escalation boundaryEvent: "Escalation code" FEEL field; writes `zeebe:escalation` extension element
- **Conditional events** — conditionalStartEvent, conditionalCatchEvent, conditional boundaryEvent: "Condition expression" FEEL field; writes `BpmnConditionalEventDefinition.condition`
- **Intermediate events** — all intermediate catch/throw events with any of the above definitions show the matching schema; plain intermediate events show name + documentation
- **Boundary events** — all boundary event variants (timer/message/signal/error/escalation/conditional) show their respective event-specific schemas; `boundaryEvent` type is now registered
- **General element coverage** — `subProcess`, `transaction`, `manualTask`, `task` (generic), `complexGateway` added; all show name + documentation

## BPMN Element Config — Call Activity, Script Task, Sequence Flow (2026-02-26, updated 2026-02-26)

- **Call activity** — configure `zeebe:calledElement processId` and `propagateAllChildVariables` in the config panel; "Select process…" button picks from open BPMN tabs; "New process" button creates a new blank BPMN and auto-links it; optional "Open Process ↗" action button navigates to the matching BPMN tab; navigate icon button in the element toolbar (HUD) above a selected call activity
- **Script task** — configure `zeebe:script expression` (FEEL expression, textarea) and `resultVariable`; replaces the generic name-only panel
- **Sequence flow condition expression** — clicking any sequence flow (edge) opens the config panel showing an editable `conditionExpression` FEEL textarea; works for gateway outgoing edges and any other flows; empty expression removes the condition element from the XML

## FEEL Language Support (2026-02-26) — `@bpmn-sdk/feel` + `@bpmn-sdk/canvas-plugin-feel-playground`

- **`@bpmn-sdk/feel`** — pure TypeScript FEEL engine; zero runtime dependencies; works in Node.js and browser
  - **Lexer** — position-aware tokenizer with full FEEL token set (temporal literals, backtick names, `..`, `**`, comments)
  - **Parser** — Pratt parser; `parseExpression()` and `parseUnaryTests()` entry points; greedy multi-word name resolution; error recovery
  - **Evaluator** — tree-walking evaluator; three-valued logic; ~60 built-in functions (string, numeric, list, context, temporal, range)
  - **Formatter** — pretty printer with configurable line-length-aware wrapping
  - **Highlighter** — `annotate()` / `highlightToHtml()` / `highlightFeel`; semantic token classification
- **`@bpmn-sdk/canvas-plugin-feel-playground`** — interactive FEEL panel in the editor
  - Expression and Unary-Tests modes; syntax-highlighted textarea; JSON context input; live evaluation; theme-aware (light/dark)
  - Opens as a full tab via `tabsPlugin.api.openTab({ type: "feel" })` — accessible from the command palette (Ctrl+K), the ⋯ main menu, and the welcome screen
  - `buildFeelPlaygroundPanel(onClose?)` exported for embedding in any container; `createFeelPlaygroundPlugin()` retained as a standalone overlay variant
- **`@bpmn-sdk/canvas-plugin-dmn-viewer` migration** — `feel.ts` now re-exports from `@bpmn-sdk/feel`; DMN cell highlighting uses the full FEEL highlighter

## Welcome Screen Examples (2026-02-26, updated 2026-02-27) — `@bpmn-sdk/canvas-plugin-tabs` + `apps/landing`

- **"Open recent" dropdown** — `getRecentProjects` option renders a dropdown button below "Import files…"; shows up to 10 most recently saved projects (Workspace / Project format); disabled when none; rebuilt on each welcome screen show
- **Dynamic sections on welcome screen** — `getWelcomeSections` option accepts a `() => WelcomeSection[]`; rebuilt on each show
- **Example entries on welcome screen** — the `examples` option accepts a `WelcomeExample[]`; each entry has a badge (BPMN / DMN / FORM / MULTI), label, optional description, and an `onOpen()` callback
- **4 built-in examples in the landing app**:
  - *Order Validation* (BPMN) — linear service-task flow
  - *Shipping Cost* (DMN) — FIRST hit-policy decision table: weight × destination
  - *Support Ticket* (FORM) — subject, category, priority, description, attachment
  - *Loan Application Flow* (MULTI) — BPMN + Credit Risk DMN + Application Form; opens all three tabs and registers resources in the resolver

## Welcome Screen + Grouped Tabs (2026-02-26, updated 2026-02-27) — `@bpmn-sdk/canvas-plugin-tabs`

- **Welcome screen** — shown when no tabs are open (and always on initial load); centered card with BPMN icon, title, "New diagram", "Import files…", and optional "Open recent" dropdown button; theme-aware (light/dark); `onNewDiagram` / `onImportFiles` / `onWelcomeShow` option callbacks
- **Plugin-managed tab XML** — subscribes to `diagram:change` internally; keeps `tab.config.xml` up to date for all open BPMN tabs; eliminates the need for client apps to track per-tab XML manually
- **Plugin-managed process tracking** — automatically parses BPMN XML on `openTab` and `diagram:change`; exposes `navigateToProcess(id)`, `getAvailableProcesses()`, `getAllTabContent()`, `closeAllTabs()` on `TabsApi`
- **Raw source toggle** — `</>` icon button in the bottom-left HUD panel; overlays a monospace `<pre>` with BPMN XML / DMN XML / Form JSON; stays in sync with live edits; disabled for FEEL tabs; button exposed via `TabsApi.rawModeButton` and placed in the HUD by `initEditorHud()`
- **Grouped tabs** — at most 3 tabs in the bar (one per type: BPMN, DMN, FORM); each group tab shows the active file name and a type badge; chevron opens a dropdown listing all files of that type; per-file close buttons in dropdown; close button on tab itself when group has only one file

## Multi-file Import + Tab Navigation in Editor (2026-02-26) — `apps/landing` + `canvas-plugins/*`

- **Import files via menu** — "Import files…" in the top-right menu opens a file picker accepting `.bpmn`, `.xml`, `.dmn`, `.form`, `.json`; each file opens in a separate tab
- **Drag-and-drop import** — drop any supported file onto the canvas to open it in a new tab
- **BPMN tab switching** — clicking a BPMN tab loads that diagram into the editor; BPMN panes are transparent so the editor canvas shows through
- **DMN/Form cross-navigation** — "Open Decision ↗" / "Open Form ↗" buttons in the config panel open the referenced file in a tab using the same `InMemoryFileResolver` populated by imports
- **`menuItems` option** added to main-menu plugin for injecting custom actions above the Theme section

## DMN Viewer + Form Viewer + Tabs Plugin (2026-02-26)

### `@bpmn-sdk/canvas-plugin-dmn-viewer`
- **Read-only DMN decision table viewer** — renders any `DmnDefinitions` as an HTML table; hit policy badge; input/output columns with type annotations
- **FEEL syntax highlighting** — tokenizes FEEL expressions in decision cells; colors keywords, strings, numbers, operators, ranges, function calls
- **Light/dark/auto themes** via CSS custom properties
- **`createDmnViewerPlugin(options)`** — canvas plugin wrapper; opens DMN viewer on click of call activities with `zeebe:calledDecision`

### `@bpmn-sdk/canvas-plugin-form-viewer`
- **Read-only Form viewer** — renders all 21 Camunda Form component types; built entirely in-repo (no `@bpmn-io/form-js` dependency)
- **Row-based grid layout** — respects `layout.row` grouping from the form schema
- **`createFormViewerPlugin(options)`** — canvas plugin wrapper; opens Form viewer on click of user tasks with `zeebe:formDefinition`

### `@bpmn-sdk/canvas-plugin-tabs`
- **Tab bar overlay** — fixed tab strip inside the canvas container for BPMN/DMN/Form tabs
- **`FileResolver` abstraction** — pluggable interface for resolving file references; `InMemoryFileResolver` default; designed for future FS/SaaS backends
- **`TabsApi`** — programmatic `openDecision(id)` / `openForm(id)` + full tab lifecycle management
- **Warning badge** — shown when a referenced DMN/Form file is not registered
- **Close-tab download prompt** — closing a tab with in-memory content shows a dialog (Cancel / Close without saving / Download & Close); the download callback serializes BPMN/DMN/Form to their respective formats and triggers a browser file download

### `@bpmn-sdk/core` — Extended form and Zeebe model
- **13 new Form component types** — number, datetime, button, taglist, table, image, dynamiclist, iframe, separator, spacer, documentPreview, html, expression, filepicker; `FormUnknownComponent` catch-all
- **`ZeebeFormDefinition`** and **`ZeebeCalledDecision`** typed interfaces in `ZeebeExtensions`

### `@bpmn-sdk/canvas-plugin-config-panel` + `config-panel-bpmn`
- **`"action"` FieldType** — clickable button fields in the config panel with `onClick` callback
- **Typed userTask panel** — `formId` field + "Open Form ↗" button wired to the tabs plugin
- **Typed businessRuleTask panel** — `decisionId` + `resultVariable` fields + "Open Decision ↗" button wired to the tabs plugin

## SubProcess Containment + Sticky Movement (2026-02-25) — `@bpmn-sdk/editor`
- **Sticky movement** — moving a subprocess moves all descendant shapes with it
- **Containment on create** — shapes dropped inside a subprocess become children in the BPMN model
- **Cascade delete** — deleting a subprocess removes all descendants from both the model and DI
- **Recursive label/connection updates** — renaming and connecting works for elements at any nesting depth

## Agentic AI Subprocess (2026-02-25) — `@bpmn-sdk/editor` + `@bpmn-sdk/canvas-plugin-config-panel-bpmn` + `@bpmn-sdk/core`
- **`adHocSubProcess` creatable in the editor** — appears in the Activities palette group (with tilde icon); 200×120 default size; resizable; type-switchable via `changeElementType`
- **AI Agent template wired end-to-end** — selecting the `io.camunda.connectors.agenticai.aiagent.jobworker.v1` template in the config panel's "Template" dropdown writes `zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1"`, `zeebe:adHoc outputCollection="toolCallResults"` + `outputElement` FEEL expression, and all required IO mappings and task headers; `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` are stamped on the element
- **`ZeebeAdHoc` typed interface** in `@bpmn-sdk/core` — `outputCollection`, `outputElement`, `activeElementsCollection`; `zeebeExtensionsToXmlElements` serialises it
- **`zeebe:adHoc` template binding** — `TemplateBinding` union extended; template engine reads/writes all three `zeebe:adHoc` properties correctly
- **Template-aware config panel for `adHocSubProcess`** — shows "Custom" or AI Agent template selector; `resolve()` delegates to full template form when template is active; clearing the template removes all modelerTemplate attributes

## Config Panel: Template Adapter Fix + Required Field Indicators (2026-02-25) — `@bpmn-sdk/canvas-plugin-config-panel` + `@bpmn-sdk/canvas-plugin-config-panel-bpmn`
- **Template adapter bug fixed** — changing any field while a connector template was active reverted the panel to the generic service task form (the write path used the base adapter which strips `zeebe:modelerTemplate`); now correctly uses the template-resolved adapter for all writes
- **Required field asterisk** — fields with `constraints.notEmpty: true` in connector templates show a red `*` next to the label
- **Required field red border** — input/select/textarea gets a red border when a required field is empty; clears as soon as the user enters a value

## Connector Template Icons in Canvas (2026-02-25) — `@bpmn-sdk/canvas` + `@bpmn-sdk/canvas-plugin-config-panel-bpmn`
- **Template icon rendering** — when a service task has `zeebe:modelerTemplateIcon` set (data URI from the connector template), the canvas renderer displays it as an SVG `<image>` in the top-left icon slot instead of the generic gear icon; works for all 116 Camunda connectors
- **Icon stamped on apply** — the config panel template engine writes `zeebe:modelerTemplateIcon` to the BPMN element whenever a connector template is applied, so the icon persists in the saved XML

## Connector Templates + Core Builder Integration (2026-02-25) — `@bpmn-sdk/canvas-plugin-config-panel-bpmn`
- **`templateToServiceTaskOptions(template, values)`** — converts any of the 116 connector templates into `ServiceTaskOptions` for the `Bpmn` builder; use any connector programmatically without hand-crafting extension XML
- **`CAMUNDA_CONNECTOR_TEMPLATES`** exported from the public API — find templates by id or name for programmatic use

## All 116 Camunda Connector Templates (2026-02-25) — `@bpmn-sdk/canvas-plugin-config-panel-bpmn`
- **`pnpm update-connectors`** — fetches all OOTB templates from the Camunda marketplace and regenerates `canvas-plugins/config-panel-bpmn/src/templates/generated.ts`
- **116 connectors** available in the connector selector: REST, Slack, Salesforce, ServiceNow, GitHub, Twilio, AWS EventBridge/Lambda/SQS/SNS, Azure, Google Sheets, WhatsApp, Facebook Messenger, and 100+ more
- **Template-ID-keyed selector** — each connector has its own distinct dropdown entry regardless of whether multiple connectors share the same underlying task definition type

## Element Templates System (2026-02-25) — `@bpmn-sdk/canvas-plugin-config-panel-bpmn` + `@bpmn-sdk/canvas-plugin-config-panel`
- **Camunda element template types** — full TypeScript type definitions (`ElementTemplate`, `TemplateProperty`, `TemplateBinding`, `TemplateCondition`) matching the Camunda zeebe-element-templates-json-schema
- **Template engine** — `buildRegistrationFromTemplate(template)` converts any element template descriptor to a `PanelSchema` + `PanelAdapter` pair; all binding types, condition types, and property types supported
- **REST Outbound Connector** — official Camunda template (`io.camunda.connectors.HttpJson.v2` v12) bundled; 8 groups, 5 auth modes (noAuth, API key, Basic, Bearer, OAuth 2.0), full output/error/retry configuration
- **Dynamic schema resolution** — `PanelAdapter.resolve?()` hook: config panel switches to the template-specific form when `zeebe:modelerTemplate` is present; re-renders on diagram change without losing state
- **`registerTemplate(template)`** — runtime API to register additional connector templates
- **`restConnector()` builder** — now stamps `zeebe:modelerTemplate` so programmatically-generated BPMN is recognized by the editor's template panel automatically

## Event Subgroups, Boundary Events & Ghost Fix (2026-02-25) — `@bpmn-sdk/editor`
- **3 event palette groups** — Start Events (5), End Events (7), Intermediate Events (10); each group contains only compatible types for type-switching
- **20 specific event palette types** — every BPMN event variant has a dedicated `CreateShapeType` with preset event definition; icons show the appropriate marker inside the ring
- **Boundary events** — any intermediate event type can be attached to an activity by hovering over it during creation; dashed blue highlight indicates attachment target; the event is positioned on the nearest boundary edge; boundary events move and delete with their host
- **Ghost shape preview** — the ghost preview now renders the correct shape for every element type (double ring for intermediate events, correct ring weight for start/end, diamond for gateways, bracket for annotations)
- **Type-switch restriction** — the configure toolbar only shows types within the same event subgroup; start, end, and intermediate events cannot be changed to each other
- **Escape to cancel** — canvas host auto-focuses when a create tool is activated, so Escape always cancels creation

## Full BPMN Element Type Coverage (2026-02-25) — `@bpmn-sdk/core` + `@bpmn-sdk/canvas` + `@bpmn-sdk/editor`
- **New core model types** — `BpmnTask`, `BpmnManualTask`, `BpmnTransaction`, `BpmnComplexGateway`; `BpmnLane`/`BpmnLaneSet` swimlane hierarchy; `BpmnMessageFlow` for inter-pool communication; five new event definition types (conditional, link, cancel, terminate, compensate)
- **Pool & lane rendering** — pools and lanes render as container rects with rotated title bars; correct nesting in the renderer
- **Message flow rendering** — dashed inter-pool arrows between participants
- **Non-interrupting boundary events** — dashed inner ring distinguishes non-interrupting from interrupting boundary events
- **Transaction subprocess** — double inner border distinguishes transaction subprocesses
- **New event markers** — conditional, link, cancel, terminate, compensate; complete event marker set
- **Complex gateway** — asterisk marker; added to creatable types with proper default bounds
- **21 element creation commands** — command palette and shape palette updated to cover all standard BPMN elements

## Element Colors & Text Annotations (2026-02-25) — `@bpmn-sdk/editor` + `@bpmn-sdk/canvas` + `@bpmn-sdk/core`
- **Shape colors** — `bioc:fill`/`bioc:stroke` (bpmn-js) and `color:background-color`/`color:border-color` (OMG) attributes rendered as inline fill/stroke on shape bodies; fully round-trips through import/export
- **Color picker** — 6 preset color swatches in the contextual toolbar for any selected flow element; clicking active swatch clears the color
- **Text annotations** — `BpmnTextAnnotation` text rendered inside the bracket shape; correct in both viewer and editor
- **Create annotation** — "Text Annotation" tool in the shape palette (Annotations group); click canvas to place; label editor opens immediately
- **Linked annotation** — "Add annotation" button in contextual toolbar creates an annotation linked to the selected shape via a `BpmnAssociation` edge
- **Annotation editing** — double-click annotation to edit its text; standard label editor
- **Cascade delete** — deleting a flow element also removes linked associations and their DI edges; deleting an annotation removes the association edges pointing to it
- **Association move** — moving a shape recomputes association edge waypoints
- **`DiColor` helpers** — `readDiColor`, `writeDiColor`, `BIOC_NS`, `COLOR_NS` exported from `@bpmn-sdk/core`

## BPMN Diagram Editor (2026-02-23) — `@bpmn-sdk/editor`
- **Full diagram editing** — create, move, resize, connect, delete, label-edit, undo/redo, copy/paste; type switching within BPMN groups
- **Edge split on drop** — drag a shape over a sequence flow to highlight it (green); release to insert the shape between source and target, splitting the edge
- **Configure bar (above element)** — shows all element types in the same BPMN group for quick type switching; label position picker for events and gateways
- **Group toolbar** — bottom toolbar shows one button per BPMN group (Events, Activities, Gateways); click to use last-selected type; long-press (500ms) opens a horizontal picker with all types in the group; standard BPMN notation icons throughout
- **`changeElementType(id, newType)`** — changes a flow element's type while preserving id, name, and connections
- **Orthogonal edges** — all sequence flows rendered as H/V-only Z-shaped paths; routes recomputed on shape move; endpoint repositioning via drag
- **Obstacle-avoiding edge routing** — new edges automatically route around existing shapes by trying all 16 port combinations and picking the first non-intersecting route
- **Edge segment drag** — hover over an edge segment to reveal a blue dot (projected cursor position) and a resize cursor (`ns-resize` for horizontal, `ew-resize` for vertical); drag perpendicularly to move the entire segment while keeping adjacent segments orthogonal
- **Edge waypoint insertion** — drag an edge at a shallower (more parallel) angle to insert a free-form bend point; diagonal edges allowed for waypoint insertion only
- **Edge endpoint repositioning** — click edge to select; drag start/end balls to reposition on source/target port (top/right/bottom/left); route recomputed via port-aware orthogonal routing
- **External label positions** — events and gateways show labels outside the shape; 8 positions via `setLabelPosition(id, pos)`; contextual toolbar compass icon to choose
- **Magnet snap** — shapes snap to aligned edges/centers of neighbors during drag; blue dashed guide lines shown
- **Contextual toolbar** — arrow icon to draw freehand connections; quick-add buttons for connected elements; label position picker for events/gateways
- **Tool system** — `setTool("select" | "pan" | "space" | "create:serviceTask" | ...)` with `editor:tool` event
- **Space tool** — click-and-drag to push elements apart; drag right/left to move elements in that half, drag up/down to move elements in that half; axis locks after 4px; amber dashed guide line shown; edges remain connected
- **Selection** — click, shift-click, rubber-band box-select; `setSelection(ids)` API; `editor:select` event; edge selection independent of shape selection
- **Undo/redo** — snapshot-based `CommandStack` (100 entries); `canUndo()` / `canRedo()` queries
- **Inline label editing** — double-click activates `contenteditable` div positioned over the shape
- **Copy/paste** — clipboard preserves inter-element flows; all IDs regenerated on paste with configurable offset
- **Export** — `exportXml()` returns BPMN 2.0 XML; `loadDefinitions(defs)` for programmatic model loading
- **Plugin compatibility** — identical `CanvasApi`; minimap and other canvas plugins work unchanged
- **Keyboard shortcuts** — Delete (shapes and edges), Ctrl+Z/Y, Ctrl+A, Ctrl+C/V, Escape
- **Events** — `diagram:change`, `editor:select`, `editor:tool` extend `CanvasEvents`

## Watermark Plugin (2026-02-25) — `@bpmn-sdk/canvas-plugin-watermark`
- **Attribution bar** — bottom-right overlay bar with configurable links and an optional square SVG logo; logo is always rightmost
- **`createWatermarkPlugin({ links?, logo? })`** — factory; `links` is an array of `{ label, url }` objects; `logo` is an SVG markup string
- Works with both canvas viewer and editor

## Canvas Plugins Workspace (2026-02-23) — `canvas-plugins/*`
- New pnpm workspace `canvas-plugins/*` for first-party canvas plugin packages
- **`@bpmn-sdk/canvas-plugin-minimap`** — minimap as an opt-in plugin; install via `plugins: [createMinimapPlugin()]`; handles `diagram:load`, `viewport:change`, `diagram:clear`; navigates via `CanvasApi.setViewport()`; fully self-contained CSS injection
- **`@bpmn-sdk/canvas-plugin-command-palette`** (2026-02-24) — Ctrl+K / ⌘K command palette; built-in commands: toggle theme, zoom to 100%/fit, export BPMN XML, zen mode; `addCommands(cmds)` extension point; works with both canvas viewer and editor
- **`@bpmn-sdk/canvas-plugin-command-palette-editor`** (2026-02-24) — editor extension plugin adding 21 BPMN element creation commands to the palette; requires `@bpmn-sdk/canvas-plugin-command-palette`
- **`@bpmn-sdk/canvas-plugin-config-panel`** (2026-02-24) — schema-driven property panel; `registerSchema(type, schema, adapter)` for extensible element forms; compact right-rail panel for single-element selection; 65%-wide full overlay with grouped tabs; auto-save on change; in-place value refresh preserves focus
- **`@bpmn-sdk/canvas-plugin-config-panel-bpmn`** (2026-02-24) — BPMN schemas for all standard element types; full Zeebe REST connector form for service tasks (method, URL, headers, body, auth, output mapping, retries)

## BPMN Canvas Viewer (2026-02-23) — `@bpmn-sdk/canvas`
- **Zero-dependency SVG viewer** — renders BPMN diagrams parsed by `@bpmn-sdk/core` with no external runtime deps
- **Framework-agnostic** — plain TypeScript/DOM; works in React, Vue, Svelte, or vanilla JS
- **Pan & zoom** — pointer-drag panning, mouse-wheel / two-finger pinch zoom, zoom-toward-cursor; RAF-batched at 60fps
- **Infinite dot-grid** — SVG `<pattern>` background that scrolls with the viewport
- **Minimap** — 160×100px overview; click-to-pan; synced viewport indicator rectangle
- **Themes** — `"light"` / `"dark"` / `"auto"` (follows `prefers-color-scheme`); implemented via CSS custom properties
- **Fit modes** — `"contain"` (scale to fit), `"center"` (1:1 centred), `"none"` (no auto-fit)
- **Accessibility** — `role="application"`, focusable shapes (Tab/Shift+Tab), keyboard pan/zoom/fit, Enter/Space to activate
- **Plugin system** — `CanvasPlugin` with `install(CanvasApi)` / `uninstall()` lifecycle
- **Events** — `diagram:load`, `diagram:clear`, `element:click`, `element:focus`, `element:blur`, `viewport:change`; `on()` returns unsubscribe fn
- **Zoom controls** — built-in +/−/⊡ buttons
- **Auto-refit** — ResizeObserver re-fits diagram on container resize
- **Small bundle** — 112KB JS / 25.95KB gzip

## Roundtrip Tests (2026-02-18)
- **34 example files tested** — 30 BPMN, 1 DMN, 3 Form files roundtrip through parse→export→re-parse
- **Typed model comparison** — validates semantic equivalence at the model level, not byte-level XML
- **XML-level roundtrip** — additional structural validation at the raw XML element tree level

## BPMN Support (2026-02-19)
- **Parse BPMN XML** — `Bpmn.parse(xml)` parses BPMN XML into a typed `BpmnDefinitions` model
- **Export BPMN XML** — `Bpmn.export(model)` serializes a `BpmnDefinitions` model back to BPMN XML
- **Fluent builder** — `Bpmn.createProcess(id)` creates processes with method chaining
- **Auto-layout** — `.withAutoLayout()` populates diagram interchange (shapes + edges) via Sugiyama layout engine
  - Opt-in: call `.withAutoLayout()` on `ProcessBuilder` before `.build()`
  - Without it, `diagrams` array remains empty (backward-compatible)
  - Handles gateway branches, sub-process containment, and orthogonal edge routing
  - Element sizing: events 36×36, tasks 100×80, gateways 36×36
  - Virtual grid: 200×160 cells with centered element placement
  - Baseline path alignment: process spine (start → gateways → end) shares same Y
  - L-shaped edge routing preferred over Z-shaped
  - Split gateways receive edges from left; join gateways from top/bottom/left based on position
  - Expanded sub-processes: containers with children are auto-sized and children laid out inside
  - Layout data survives export→parse→export round-trips
- **Gateway support** — exclusive, parallel, inclusive, event-based gateways with `branch(name, callback)` pattern
- **Auto-join gateways** — split gateways automatically get matching join gateways inserted when branches converge (BPMN best practice)
- **Loop support** — `connectTo(targetId)` for merge points and back-edge loops
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content
- **Multi-instance** — parallel/sequential multi-instance with Zeebe extension elements
- **Aspirational elements** — sendTask, receiveTask, businessRuleTask builders
- **REST connector builder** — `restConnector(id, config)` convenience method generates service tasks with `io.camunda:http-json:1` task type, IO mappings (method, url, auth, body, headers, queryParameters, timeouts), and task headers (resultVariable, resultExpression, retryBackoff)
- **Extension preservation** — zeebe:*, modeler:*, camunda:* extensions roundtrip as `XmlElement[]`
- **Root-level messages** — `bpmn:message` elements parsed, preserved, and serialized at definitions level
- **Message start events** — builder creates proper `<bpmn:message>` root elements with ID references
- **Webhook/connector config** — `zeebe:properties` support for connector configuration (e.g. webhook inbound type, method, context)
- **Agentic AI sub-process** — `adHocSubProcess()` supports full AI agent pattern: `taskDefinition`, `ioMapping`, `taskHeaders`, `outputCollection`/`outputElement` on `zeebe:adHoc`, modeler template attributes
- **Call activity** — `callActivity(id, {processId, propagateAllChildVariables})` with `zeebe:calledElement` extension
- **Diagram interchange** — BPMNDI shapes and edges preserved on roundtrip

## Form Support (2026-02-18)
- **Parse Form JSON** — `Form.parse(json)` parses Camunda Form JSON into a typed `FormDefinition` model
- **Export Form JSON** — `Form.export(model)` serializes a `FormDefinition` model to JSON
- **8 component types** — text, textfield, textarea, select, radio, checkbox, checklist, group
- **Recursive groups** — nested group components with arbitrary depth

## DMN Support (2026-02-18)
- **Parse DMN XML** — `Dmn.parse(xml)` parses DMN XML into a typed `DmnDefinitions` model
- **Export DMN XML** — `Dmn.export(model)` serializes a `DmnDefinitions` model back to DMN XML
- **Fluent builder** — `Dmn.createDecisionTable(id)` creates decision tables with method chaining
- **Multi-output tables** — support for 2+ output columns per decision table
- **Hit policies** — UNIQUE (default), FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY
- **Roundtrip fidelity** — semantic equivalence preserved on parse→export cycle
- **Namespace preservation** — DMN, DMNDI, DC, modeler namespace declarations roundtrip correctly
