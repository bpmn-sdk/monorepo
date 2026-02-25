# Features

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

## Canvas Plugins Workspace (2026-02-23) — `canvas-plugins/*`
- New pnpm workspace `canvas-plugins/*` for first-party canvas plugin packages
- **`@bpmn-sdk/canvas-plugin-minimap`** — minimap as an opt-in plugin; install via `plugins: [createMinimapPlugin()]`; handles `diagram:load`, `viewport:change`, `diagram:clear`; navigates via `CanvasApi.setViewport()`; fully self-contained CSS injection
- **`@bpmn-sdk/canvas-plugin-command-palette`** (2026-02-24) — Ctrl+K / ⌘K command palette; built-in commands: toggle theme, zoom to 100%/fit, export BPMN XML, zen mode; `addCommands(cmds)` extension point; works with both canvas viewer and editor
- **`@bpmn-sdk/canvas-plugin-command-palette-editor`** (2026-02-24) — editor extension plugin adding 12 BPMN element creation commands to the palette; requires `@bpmn-sdk/canvas-plugin-command-palette`
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
