# Progress

## 2026-02-24

### Command palette plugins — `@bpmn-sdk/canvas-plugin-command-palette` + `@bpmn-sdk/canvas-plugin-command-palette-editor`
- **`@bpmn-sdk/canvas-plugin-command-palette`** — base Ctrl+K / ⌘K command palette for both canvas and editor
  - Built-in commands: toggle theme (dark → light → auto cycle), zoom to 100%, zoom to fit, export as BPMN XML, zen mode
  - **Zen mode**: adds `bpmn-zen-mode` class to container (hides `.bpmn-zoom-controls` / `.bpmn-main-menu-panel` via CSS), hides dot grid rects in SVG, calls `onZenModeChange` callback for external HUD hiding
  - `CommandPalettePlugin.addCommands(cmds): () => void` — extension point; returns deregister function
  - Module-level singleton ensures only one palette open at a time across all instances
  - Theme-aware: resolves "auto" via `window.matchMedia`; light theme applies `bpmn-palette--light` class
  - 14 tests in `canvas-plugins/command-palette/tests/index.test.ts`
- **`@bpmn-sdk/canvas-plugin-command-palette-editor`** — extends base palette with 12 BPMN element creation commands
  - Commands: Add Start Event, Add End Event, Add Service/User/Script/Send/Receive/Business Rule Task, Add Exclusive/Parallel/Inclusive/Event-based Gateway
  - Activates via `setTool("create:X")` using lazy `editorRef` pattern (avoids circular dependency at construction time)
  - Deregisters all commands on `uninstall()`; 4 tests in `canvas-plugins/command-palette-editor/tests/index.test.ts`
- **Landing page**: palette wired with `onZenModeChange` hiding `.hud` elements; editor plugin uses lazy `editorRef`

### `@bpmn-sdk/editor` — Space tool
- **Space tool** (`"space"`) added to `Tool` type; `setTool("space")` activates it
- **Behavior**: click and hold anywhere on the canvas, then drag to push elements apart:
  - Drag right → all elements whose center is to the right of the click x-position move right by the drag distance
  - Drag left → all elements to the left of the click x-position move left
  - Drag down → all elements below the click y-position move down
  - Drag up → all elements above the click y-position move up
  - Axis locks after 4 diagram-space pixels of movement (dominant axis wins)
  - Edges are recomputed on commit via `moveShapes` (existing behavior)
- **Visual feedback**: amber dashed split-line (`.bpmn-space-line`) drawn at the drag origin during drag
- **Implementation**: new `SpaceSub` state (`idle` / `dragging`), `{ mode: "space" }` EditorMode variant, `previewSpace`/`commitSpace`/`cancelSpace` callbacks, `setSpacePreview` on `OverlayRenderer`
- **Landing editor**: space button added to bottom toolbar between Select/Hand buttons and the element groups

### Editor toolbar — standard BPMN groups, icons, long-press picker
- **Undo/redo icons** fixed: replaced confusing arc-based icons with clean U-shaped curved-arrow icons (polyline arrowhead + D-shaped arc body), matching standard design-tool conventions
- **Bottom toolbar redesigned**: replaced individual element buttons with one button per BPMN group (Events, Activities, Gateways); clicking uses the last-selected element type; holding 500ms opens a horizontal group picker showing all element types in that group
- **Group picker**: floating panel appears above the button; selecting an element type sets it as the group default and activates the create tool
- **Extended `CreateShapeType`**: added `sendTask`, `receiveTask`, `businessRuleTask`, `inclusiveGateway`, `eventBasedGateway`; all wired in `makeFlowElement`, `changeElementType`, `defaultBounds`, and `RESIZABLE_TYPES`
- **Standard BPMN icons**: all toolbar icons follow BPMN 2.0 notation — events as circles (thin=start, thick=end), activities as rounded rectangles with type markers (gear/person/lines/filled-envelope/outlined-envelope/grid), gateways as diamonds with type markers (X/+/O/double-circle)
- **Configure bar (above element)** now shows all element types in the same BPMN group, using the same full group switcher; previously only showed 2–3 hardcoded options
- **`EXTERNAL_LABEL_TYPES`** extended to include `inclusiveGateway` and `eventBasedGateway`

## 2026-02-23 (6)

### `@bpmn-sdk/editor` — Configure bar, edge split, label fix, scriptTask
- **Fix: label moves with shape** — `moveShapes` now also translates `BpmnDiShape.label.bounds` by `(dx, dy)` when present; previously external labels on events/gateways stayed behind when the shape was moved
- **Edge split on drop** — dragging a shape over an existing sequence flow highlights the edge in green; dropping inserts the shape between source and target (original edge removed, two new connections created); edges connected to the dragged shape are excluded; `insertShapeOnEdge(defs, edgeId, shapeId)` new modeling function
- **Configure bar above element** — a new HUD panel appears above the selected element with type-switching buttons and label-position picker; replaces label position from the below bar
  - Tasks: service task / user task / script task type switcher (active button shows current type)
  - Gateways: exclusive gateway / parallel gateway type switcher + label position
  - Events: label position only
- **`changeElementType(id, newType)`** — new `BpmnEditor` public method; preserves element id, name, incoming, and outgoing; uses new `changeElementType(defs, id, newType)` modeling function
- **`scriptTask` added** to `CreateShapeType`; added to `RESIZABLE_TYPES`; `makeFlowElement` handles it; ghost create shape renders as rectangle (correct for tasks)
- **5 new tests** in `tests/modeling.test.ts`: label-bounds translation, changeElementType (gateway, task, scriptTask), insertShapeOnEdge split

## 2026-02-23 (5)

### `@bpmn-sdk/editor` — Label positions and edge endpoint repositioning
- **External labels for events/gateways**: canvas renderer always renders external labels for startEvent, endEvent, intermediateEvents, boundaryEvent, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway when the element has a name; default position is bottom-centered (80×20px, 6px gap)
- **`setLabelPosition(shapeId, position)`**: new `BpmnEditor` public method; accepts 8 positions: `"bottom" | "top" | "left" | "right" | "bottom-left" | "bottom-right" | "top-left" | "top-right"`; persists label bounds in BPMN DI
- **Label position dropdown**: contextual toolbar now shows a compass icon for events and gateways; clicking opens a dropdown with 4 options (events) or 8 options (gateways)
- **End event in contextual toolbar**: end events now show a contextual toolbar with the label position option (previously hidden entirely)
- **`LabelPosition` type exported** from `@bpmn-sdk/editor`
- **Edge selection**: clicking on a sequence flow line selects it and shows draggable endpoint balls at start and end; edge and shape selection are mutually exclusive
- **Edge endpoint repositioning**: dragging an endpoint ball snaps it to the nearest port (top/right/bottom/left) of the source or target shape; route is recomputed orthogonally via `computeWaypointsWithPorts`
- **Transparent edge hit areas**: invisible 12px-wide stroke polylines added to each edge group for easier clicking
- **Delete edge**: pressing Delete/Backspace while an edge is selected removes it
- **`deleteElements` handles flow IDs**: `deleteElements` now also removes sequence flows when their own ID is in the `ids` array (not just when their source/target is deleted)
- **Port-aware waypoint routing** (`computeWaypointsWithPorts`): H+H (Z or U), V+V (Z or U), H+V / V+H (L-route) — all combinations handled orthogonally

## 2026-02-23 (4)

### `@bpmn-sdk/editor` — UX improvements
- **Orthogonal edges**: `computeWaypoints` now produces H/V-only paths (Z-shape with 4 waypoints or straight horizontal); `boundaryPoint` diagonal routing removed
- **Edge recompute on move**: `moveShapes` recomputes orthogonal waypoints from updated shape bounds when only one endpoint moves
- **Hover port balls removed**: `OverlayRenderer.setHovered` no longer renders connection port circles — connections are initiated exclusively via the contextual toolbar
- **Arrow button in contextual toolbar**: clicking the arrow icon enters connection-drawing mode; user then clicks any target shape to complete the connection
- **`startConnectionFrom(sourceId)`**: new `BpmnEditor` public method to programmatically enter connecting mode from a specific source shape
- **Click-to-connect state machine**: `EditorStateMachine.onPointerDown` now handles the `connecting` sub-state — a click commits or cancels the in-progress connection (supports ctx-toolbar flow alongside existing drag-from-port flow)
- **Magnet snap helpers**: during shape translate, cursor snaps to aligned edges/centers of non-selected shapes within 8 screen pixels; blue dashed alignment guides rendered in overlay while dragging
- **Landing page 100% zoom**: editor now opens at `fit: "center"` (1:1 scale) instead of `fit: "contain"`

## 2026-02-23 (3)

### `@bpmn-sdk/editor` package — BPMN diagram editor
- New package `packages/editor` (`@bpmn-sdk/editor`) — a full BPMN 2.0 diagram editor built on top of `@bpmn-sdk/canvas` internals
- **Create shapes**: start/end events, service/user tasks, exclusive/parallel gateways via `setTool("create:serviceTask")` etc.
- **Connect shapes**: drag from shape port to draw sequence flows with auto-computed waypoints
- **Move shapes**: drag to reposition; multi-select moves all selected shapes together
- **Resize shapes**: 8-handle resize with minimum size enforcement (20×20)
- **Delete elements**: removes shapes and all connected sequence flows; cleans up incoming/outgoing references
- **Undo/redo**: snapshot-based `CommandStack` (up to 100 snapshots); `undo()`, `redo()`, `canUndo()`, `canRedo()`
- **Selection**: click to select, shift-click to add/remove, rubber-band drag to box-select, `setSelection(ids)` API
- **Label editing**: double-click shape → `contenteditable` div positioned over SVG; commits on blur/Enter, cancels on Escape
- **Copy/paste**: `Ctrl+C` / `Ctrl+V` with offset; all IDs regenerated on paste
- **Export**: `exportXml()` returns BPMN XML via `Bpmn.export()`; load via `load(xml)` or `loadDefinitions(defs)`
- **Events**: `diagram:change`, `editor:select`, `editor:tool` (all extend `CanvasEvents`); `on()` returns unsubscribe fn
- **Plugin compatibility**: identical `CanvasApi` for plugins; minimap plugin works unchanged
- **Keyboard shortcuts**: Delete/Backspace (delete), Ctrl+Z/Y (undo/redo), Ctrl+A (select all), Ctrl+C/V (copy/paste), Escape (cancel/deselect)
- **Architecture**: 15 source files — `id.ts`, `types.ts`, `rules.ts`, `geometry.ts`, `modeling.ts`, `command-stack.ts`, `css.ts`, `overlay.ts`, `label-editor.ts`, `state-machine.ts`, `editor.ts`, `index.ts`
- **45 tests** across 3 test files: `modeling.test.ts` (15), `command-stack.test.ts` (13), `editor.test.ts` (17)
- Modified `packages/canvas/src/viewport.ts`: added `lock(locked: boolean)` method (prevents panning during drags/resizes)
- Modified `packages/canvas/src/index.ts`: exported internals (`ViewportController`, `render`, `KeyboardHandler`, `injectStyles`, etc.)
- Modified root `tsconfig.json`: added `packages/editor` reference
- Verification: `pnpm turbo build typecheck check test` — 6/6 tasks pass, 45 tests pass, zero errors

## 2026-02-23 (2)

### `canvas-plugins/` workspace — minimap extracted as a plugin
- New pnpm workspace glob `canvas-plugins/*` added to `pnpm-workspace.yaml`
- New package `canvas-plugins/minimap` → `@bpmn-sdk/canvas-plugin-minimap`
  - `Minimap` class moved from `packages/canvas/src/minimap.ts` — import `ViewportState` from `@bpmn-sdk/canvas`, `BpmnDefinitions` from `@bpmn-sdk/core`
  - Added `Minimap.clear()` method (clears shapes, edges, resets viewport rect)
  - Minimap CSS extracted to `canvas-plugins/minimap/src/css.ts` with its own `injectMinimapStyles()` / `MINIMAP_STYLE_ID`
  - `createMinimapPlugin()` factory returns a `CanvasPlugin` that: installs minimap into `api.container`, subscribes to `diagram:load` / `viewport:change` / `diagram:clear`, navigates by calling `api.setViewport()`, and tears everything down on `uninstall()`
  - 9 tests in `canvas-plugins/minimap/tests/minimap-plugin.test.ts`
- Removed from `packages/canvas`: `minimap.ts`, `CanvasOptions.minimap`, minimap CSS, `_minimap` field, `_showMinimap` field, `_syncMinimap()` method, minimap construction and update calls, `--bpmn-viewport-fill`/`--bpmn-viewport-stroke` CSS vars
- Landing page updated: imports `createMinimapPlugin` from `@bpmn-sdk/canvas-plugin-minimap`, passes it via `plugins: [createMinimapPlugin()]`; removed `minimap: true` option
- Verification: `pnpm turbo build typecheck check test` — 15/15 tasks pass, zero errors

## 2026-02-23

### `@bpmn-sdk/canvas` package — BPMN diagram viewer
- New package `packages/canvas` (`@bpmn-sdk/canvas`) — a zero-dependency, framework-agnostic SVG BPMN viewer
- **SVG rendering**: shapes (events, tasks, gateways, annotations), edges with arrowheads, text labels — all layered (edges → shapes → labels)
- **Viewport**: pan (pointer drag), zoom (wheel + pinch), click-vs-drag discrimination (4px threshold), RAF-batched transforms for 60fps
- **Infinite dot-grid** via SVG `<pattern>` with `patternTransform` synced to viewport
- **Minimap**: 160×100px overview in bottom-right corner; simplified rects/circles + polylines; click-to-pan
- **Themes**: light (default), dark (`data-theme="dark"` attribute), auto (follows `prefers-color-scheme`)
- **Fit modes**: `"contain"` (scale to fit), `"center"` (1:1 zoom, centred), `"none"` (no auto-fit)
- **Accessibility**: `role="application"`, focusable shape elements (`tabindex="-1"`), Tab/Shift+Tab navigation, Enter/Space to click, arrow keys to pan, +/- to zoom, 0 to fit
- **Plugin system**: `CanvasPlugin` interface with `install(api: CanvasApi)` / `uninstall()` lifecycle; `CanvasApi` exposes shapes, edges, viewport, events
- **Events**: `diagram:load`, `diagram:clear`, `element:click`, `element:focus`, `element:blur`, `viewport:change`; `on()` returns unsubscribe function
- **CSS injection**: `injectStyles()` idempotently injects styles once; all CSS via custom properties for easy theming
- **ResizeObserver**: auto re-fits on container resize
- **Zoom controls**: +/−/⊡ buttons injected into DOM
- **14 tests** in `packages/canvas/tests/canvas.test.ts` (happy-dom environment)
- **Landing page updated**: replaced `bpmn-js` with `@bpmn-sdk/canvas`; removed bpmn.io CSS; diagrams render in dark theme with grid + minimap
- **Bundle size**: 112KB JS / 25.95KB gzip (vs bpmn-js which is ~500KB+)
- **GitHub Actions fix**: `.github/workflows/deploy-pages.yml` — changed `actions/upload-pages-artifact@v3` to `actions/upload-artifact@v4` (required by `actions/deploy-pages@v4`)
- Verification: `pnpm turbo build typecheck check test` — 11/11 tasks pass, zero errors

## 2026-02-21

### XML Output Tabs on Landing Page
- Each example panel now has Diagram / XML Output sub-tabs.
- Users can switch between the live rendered BPMN diagram and the raw XML source.
- XML content is populated from the examples data and HTML-escaped for display.

### Landing Page
- **Landing page app**: Created `apps/landing/` — a Vite-built static site showcasing the SDK.
- Hero section with strong AI-native hook, feature cards (zero deps, auto-layout, type-safe, roundtrip fidelity, Camunda 8 ready).
- Side-by-side comparison: raw BPMN XML vs fluent SDK API.
- Interactive examples with tabbed code snippets and live BPMN diagram rendering via bpmn-js (bpmn.io).
- Four examples: Simple Process, Decision Gateway, Parallel Execution, AI Agent (with adHocSubProcess).
- Getting Started section with 3-step quick start.
- Added `apps/*` to pnpm workspace, `vite` as root devDependency.
- GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) for automatic deployment to GitHub Pages.
- Verification: `pnpm verify` — all tasks pass (SDK 308 tests + landing build/typecheck/check).

### Remove fast-xml-parser dependency (zero runtime dependencies)
- **Custom XML parser/serializer**: Replaced the `fast-xml-parser` dependency with a lightweight custom implementation (~200 lines) in `packages/bpmn-sdk/src/xml/xml-parser.ts`. The SDK now has **zero runtime dependencies**.
- The custom parser handles namespaced elements/attributes, self-closing tags, text content, CDATA sections, and skips processing instructions/comments — everything needed for BPMN and DMN XML.
- The serializer produces formatted XML with 2-space indentation, self-closing empty elements, and `&quot;` escaping in attributes.
- Entity/character references are passed through unchanged (matching the previous `processEntities: false` behavior).
- Public API (`parseXml`, `serializeXml`, `XmlElement` type) unchanged.
- Verification: `pnpm verify` — 308 tests pass, zero errors

## 2026-02-20

### Auto-Join Gateways (BPMN Best Practice)
- **Automatic join gateway insertion**: When multiple branches from the same split gateway converge on a non-gateway target, a matching join gateway is automatically inserted before the target. For example, an exclusive gateway split automatically gets a matching exclusive join gateway.
- The algorithm traces back from targets with 2+ incoming flows to identify which split gateway they belong to, then inserts a join of the same type.
- Existing manually-created join gateways are detected and not duplicated.
- Early-return branches (with distinct targets) are not affected.
- `ServiceTaskOptions.name` is now mandatory — all service tasks must have a name.
- Vertical center-Y alignment fix: expanded sub-processes are re-centered on their original baseline after expansion.
- Verification: `pnpm verify` — 308 tests pass, zero errors

### Expanded Sub-Processes & modelerTemplateIcon Support
- **Expanded sub-process layout**: Sub-processes with child elements are now expanded on the canvas — children are recursively laid out inside the container using the full Sugiyama layout pipeline. The `layoutSubProcesses()` function (previously unused) is now integrated into the layout engine after phase 4g. Expanded sub-processes have `isExpanded="true"` in the BPMN diagram.
- **Post-expansion cascade**: After subprocess expansion, a cascade pass ensures all subsequent layers maintain minimum 50px horizontal gap, preventing element/label overlaps.
- **`modelerTemplateIcon` on all builders**: Fixed `SubProcessContentBuilder.serviceTask()` to set `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` attributes (was missing — `ProcessBuilder` and `BranchBuilder` already had this support).
- **Updated agent workflow example**: Added `modelerTemplateIcon` to all template-bearing elements (webhook start event, AI agent ad-hoc subprocess, Slack service tasks, HTTP JSON tool tasks). Tool service tasks inside the ad-hoc subprocess now render with proper icons and are visible on the expanded canvas.
- Verification: `pnpm verify` — 305 tests pass, zero errors

### New Element Support from examples2/
- **`bpmn:message` root element**: Added `BpmnMessage` model type, `messages` array on `BpmnDefinitions`, parser/serializer support for `<bpmn:message>` at definitions level. Messages are now preserved during parse→export roundtrip.
- **`zeebe:properties` extension**: Added `ZeebeProperties`/`ZeebePropertyEntry` interfaces to `ZeebeExtensions`. Builder support via `zeebeProperties` option on `StartEventOptions`. Used for webhook/connector configuration.
- **Enhanced message start events**: `startEvent()` with `messageName` now creates a proper root-level `<bpmn:message>` element and references it by ID. Also supports `zeebeProperties`, `modelerTemplate`, `modelerTemplateVersion`, `modelerTemplateIcon` options.
- **Enhanced `adHocSubProcess` for AI agent pattern**: Added `taskDefinition`, `ioMapping`, `taskHeaders`, `outputCollection`, `outputElement`, and modeler template options to `AdHocSubProcessOptions`. Supports the agentic AI subprocess pattern (e.g., Camunda AI Agent with tool tasks).
- **Roundtrip tests for examples2/**: 3 example files (Fetch Features, Fetch Notes, PDP Product Board Filtering) all roundtrip correctly. Added 11 new roundtrip tests and 7 element parsing tests.
- Verification: `pnpm verify` — 305 tests pass, zero errors

### Minimum Row Gap Between Elements & Gateway Label Position
- **Minimum row gap**: `distributeSplitBranches()` now uses two-pass processing (multi-branch first, single-branch second) with peer-aware gap enforcement. Single-branch gateways check all chain nodes against layer peers and push further away if any gap would be less than `GRID_CELL_HEIGHT/2` (80px).
- **Gateway labels**: Labels moved from centered-above to **top-right** position (`x = bounds.right + 4, y = bounds.top - labelHeight - 4`), preventing overlap with upward edge paths.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Symmetric Branch Distribution for Split Gateways
- **Symmetric branches**: Added `distributeSplitBranches()` — branches of split gateways with 2+ non-baseline branches are now equally distributed above and below the gateway center Y, spaced by `GRID_CELL_HEIGHT` (160px)
- **Single-branch gateways**: Gateways with exactly 1 non-baseline branch (e.g., early-return splits) now place the branch a full `GRID_CELL_HEIGHT` away from the gateway center, ensuring clear separation from inner gateway branches
- **Layer overlap resolution**: Added `resolveLayerOverlaps()` — after redistribution, overlapping nodes within the same layer are pushed apart with minimum gap, and coordinates are normalized to ensure no negative Y values
- Example result: `parallelStart` (cy=251) branches at processPayment (cy=171) and checkInventory (cy=331); early return at notifyRejection/endRejected (cy=91) — one full grid row above
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Collapsed Sub-Processes & Baseline Continuation Through Early-Return Splits
- **Collapsed sub-processes**: Sub-processes now render at 100×80 (same as regular tasks) instead of being expanded to show child elements. Removed the sub-process expansion phase from the layout engine.
- **Baseline continuation**: `findContinuationSuccessor()` now correctly follows gateway successors as baseline continuation points. When a split gateway has one early-return branch (dead-end) and one branch leading to another gateway, the gateway branch is chosen as the baseline continuation. Non-gateway branches are never promoted to the baseline.
- **Overlap fix**: Fixed 3 test failures caused by branch nodes being incorrectly placed on the baseline (overlapping siblings). The fix ensures that only gateway successors are followed as continuation, preventing branch content from being aligned to the baseline Y.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Baseline Path Alignment & Gateway Edge Fix
- **Baseline path detection**: Added `findBaselinePath()` that identifies the process "spine" — the sequence of nodes every path must traverse (start event → gateways → end event), skipping branch content
- **Baseline Y-alignment**: Added `alignBaselinePath()` that forces all spine nodes to share the same center-Y, ensuring start and end events are horizontally aligned
- **Gateway incoming edge fix**: Updated `resolveTargetPort()` to distinguish split (starting) vs join (closing) gateways:
  - Split gateways: incoming edges always connect from the left
  - Join gateways: incoming edges connect based on relative position (above→top, below→bottom, same Y→left)
- Added 5 new tests: baseline path detection (2), baseline Y-alignment (2), split gateway left-side port (1)
- Verification: `pnpm verify` — 287 tests pass, zero errors

### XML Attribute Value Escaping Fix
- Fixed `serializeXml()` to escape `"` as `&quot;` in XML attribute values
- Root cause: `fast-xml-parser` `XMLBuilder` with `processEntities: false` writes attribute values verbatim, producing invalid XML when values contain double quotes (e.g., FEEL expressions like `=erpBaseUrl + "/api/orders"`)
- Added regression test for attribute escaping and roundtrip
- Regenerated `order-process.bpmn` with proper escaping
- Verification: `pnpm verify` — 282 tests pass, zero errors

### Grid-Based Layout & Edge Routing Improvements
- **Virtual grid system**: Replaced cumulative-offset coordinate assignment with a 200×160 virtual grid
  - All elements placed in grid cells, centered horizontally and vertically within cells
  - Grid cells merge automatically for oversized elements (e.g., expanded sub-processes)
  - Grid constants: `GRID_CELL_WIDTH=200`, `GRID_CELL_HEIGHT=160`
- **Gateway size**: Changed gateway dimensions from 50×50 to 36×36 (matching BPMN standard)
- **L-shaped edge routing**: Forward edges now prefer L-shaped paths (1 bend) over Z-shaped paths (2 bends)
  - `routeForwardEdge()` produces horizontal→vertical L-shape instead of horizontal→vertical→horizontal Z-shape
  - `routeFromPortDirect()` also uses L-shaped routing from top/bottom ports
- **Early-return branch positioning**: Added `ensureEarlyReturnOffBaseline()` — shorter branches at gateway splits are swapped off the baseline so they're never on the split gateway's center-y
- **Edge connection rules** (unchanged, verified):
  - Non-gateway elements: outgoing from right center, incoming to left center
  - Starting gateways: incoming on left, vertically centered
  - Closing gateways: incoming from top/bottom/left based on relative position
- Added 5 new tests: grid cell centering, grid layer spacing, grid row spacing, L-shaped edge preference, early-return off-baseline
- Verification: `pnpm verify` — build, typecheck, check, test (281 pass) — all zero errors

### Edge Routing & Vertical Spacing Improvements
- Changed `VERTICAL_SPACING` from 80px to 160px for better visual separation between branches
- Added `resolveTargetPort()` to determine edge entry side: non-gateway targets always enter from the left; gateway targets enter top/bottom/left based on source relative Y position (with +/-1px tolerance)
- Integrated `resolveTargetPort` into `routeForwardEdge()` and `routeFromPortDirect()` for correct target-side routing
- Added 2 new `resolveTargetPort` test cases (non-gateway always left, gateway Y-based with tolerance)
- Added 2 integration tests in `builder-layout-integration.test.ts` for non-gateway left-entry and branch vertical spacing
- Verification: `pnpm turbo build`, `pnpm turbo test` (276 pass), `pnpm biome check .`, `pnpm turbo typecheck` — all zero errors

## 2026-02-19

### Layout Engine QA Fixes — Branch Alignment, Split/Join, Labels, Routing
- **Branch baseline alignment**: Added `alignBranchBaselines()` to `coordinates.ts` — nodes in linear sequences (non-gateway, single-pred/single-succ chains) now share the same center-y coordinate
- **Split/join Y-alignment**: Added `alignSplitJoinPairs()` to `coordinates.ts` — merge gateways are forced to the same y-coordinate as their corresponding split gateway
- **Edge label collision avoidance**: Replaced simple midpoint label placement with collision-aware system in `routing.ts`:
  - Generates 5 candidate positions along the longest edge segment (at 25%/33%/50%/67%/75%) with above/below offsets
  - Greedy placement: processes labels in order, picks first non-overlapping candidate
  - Fallback: slides label along segment in 10 steps to find clear space
- **Edge routing efficiency**: `routeFromPort()` now compares assigned-port route against right-port route by bend count, preferring the assigned port unless right-only gives strictly fewer bends; back-edges now evaluate routing above vs. below all nodes and pick the shorter path
- **VERTICAL_SPACING test fix**: Updated test to check against imported `VERTICAL_SPACING` constant instead of hardcoded `60`
- Integrated `alignBranchBaselines` and `alignSplitJoinPairs` as phases 4b/4c in `layout-engine.ts`
- Added 8 new tests: linear baseline alignment, branch divergence, fork/join parallel alignment, fork/join exclusive alignment, label-node non-overlap, label-label non-overlap, forward edge bend limit, gateway bend efficiency
- All 272 tests pass, zero lint errors, zero build warnings

### Gateway Port Assignment for Auto-Layout
- Added gateway port assignment logic to `routing.ts` — gateway outgoing edges now follow BPMN port conventions
  - Odd outgoing edges: middle edge exits right, upper half exits top, lower half exits bottom
  - Even outgoing edges: upper half exits top, lower half exits bottom (no right port)
  - Single outgoing edge: exits right (straight horizontal)
- Added `routeFromPort()` Z-shaped routing from top/bottom ports, keeping vertical segments in the safe mid-zone between layers
- Exported `assignGatewayPorts` and `PortSide` type for direct unit testing
- 8 new tests covering port assignment (1/2/3/4/5 edges, empty, waypoint positions, non-gateway passthrough)
- All 277 tests pass, zero lint errors, zero build warnings

### Auto-Layout Documentation
- Added auto-layout section to README with full usage example showing `.withAutoLayout()` on a gateway workflow
- Added `withAutoLayout()` to builder methods table in API reference under new "Layout" category
- Expanded `doc/features.md` auto-layout entry with configuration details (opt-in behavior, element sizing, round-trip fidelity)

### Builder Layout Integration Tests
- Added `builder-layout-integration.test.ts` with 15 integration tests verifying auto-layout data generation for builder-created workflows
- Tests cover: shape/edge completeness, valid bounds, no overlaps, left-to-right ordering, DI ID conventions, orthogonal edge routing, element-type sizing, subprocess child containment, complex multi-pattern workflows, export→parse roundtrip, double roundtrip, and XML element verification
- Added round-trip position stability test to `bpmn-builder.test.ts`
- Updated `examples/create-workflow.ts` to use `.withAutoLayout()`
- Regenerated `order-process.bpmn` example output with layout data

## 2026-02-18

### Builder errorCode→errorRef Fix
- Fixed `buildEventDefinitions` to auto-generate a root `BpmnError` element when `errorCode` is provided without `errorRef`, ensuring boundary events built with only `errorCode` serialize with a valid `errorRef`

### Review Fixes
- Fixed `buildEventDefinitions` to pass `timeDate` and `timeCycle` into timer event definitions
- Fixed `buildEventDefinitions` to store `messageName`/`signalName`/`escalationCode` as `messageRef`/`signalRef`/`escalationRef`
- Added `timeDate`, `timeCycle` (and attribute maps) to `BpmnTimerEventDefinition` model type
- Added `timeDate`/`timeCycle` parsing and serialization for XML roundtrip support
- Added duplicate ID check when merging branch elements into the main process
- Removed `.swarm` session artifacts from version control and added to `.gitignore`

### Comprehensive README Rewrite
- Rewrote root `README.md` with best-practices structure matching top-tier SDKs
- Added "Why this SDK?" section with value propositions
- Added feature matrix table (BPMN/DMN/Forms × Parse/Build/Export)
- Added advanced examples: REST connector, parallel branches, boundary events, sub-processes, roundtrip workflow, type narrowing
- Added "Best Practices" section: descriptive IDs, discriminated unions, branch patterns, roundtrip modifications, composable processes
- Enhanced API reference with return types and categorized builder methods table
- Added semantic versioning guidance to contributing section

### Enhanced README and Changesets
- Enhanced root `README.md` with badges (npm, TypeScript, license), table of contents, requirements section, yarn install option, expanded contributing guide with code quality expectations and release workflow
- Added TypeScript usage section with discriminated union type narrowing examples
- Added REST connector convenience builder example
- Fixed README code examples to use correct `taskType` property name (was `type`)
- Added MIT `LICENSE` file
- Changesets (`@changesets/cli`, `@changesets/changelog-github`) configured for version management and publishing
- Committed `.changeset/` directory with `config.json` and `README.md`
- Fixed changeset config to use `@changesets/changelog-github` with repo setting for PR/author links
- Added `changeset`, `version-packages`, and `release` scripts to root `package.json`
- Removed accidentally committed `.swarm/` session artifacts from version control
- Added `.swarm` to `.gitignore`
- Added auto-layout feature to README feature list
- Added GitHub Actions CI workflow (build, typecheck, lint, test on push/PR)
- Added GitHub Actions Release workflow using `changesets/action` for automated version PRs and npm publishing

### Timer Event Definition Attribute Roundtrip Fix
- Added `timeDateAttributes` and `timeCycleAttributes` to `BpmnTimerEventDefinition` model
- Parser now extracts attributes (e.g. `xsi:type`) from `timeDate` and `timeCycle` elements, matching existing `timeDuration` handling
- Serializer now emits those attributes on roundtrip, preventing loss of `xsi:type`

## 2026-02-19

### Auto-Layout for ProcessBuilder
- Added `withAutoLayout()` fluent method to `ProcessBuilder` — when enabled, `build()` runs the Sugiyama layout engine and populates `BpmnDiagram` with DI shapes (bounds) and edges (waypoints)
- Layout-to-DI conversion maps `LayoutResult` nodes/edges to `BpmnDiShape`/`BpmnDiEdge` with proper element references
- Without `withAutoLayout()`, behavior is unchanged (`diagrams: []`)
- 4 new tests: default empty diagrams, linear flow DI, gateway branch DI, export→parse roundtrip with DI

### BPMN Fluent Builder API — Full Implementation
- Rewrote `bpmn-builder.ts` with complete fluent builder API (~1400 lines)
- **Gateway branching**: `branch(name, callback)` with `BranchBuilder` sub-builders
  - `condition(expression)` sets FEEL condition on branch sequence flow
  - `defaultFlow()` marks branch as gateway default path
  - Both conditions and defaults work with direct `connectTo()` (no intermediate elements)
- **Flow control**: `connectTo(id)` for merging branches and creating loops (backward references)
- **Navigation**: `element(id)` repositions builder at existing element for additional outgoing flows
- **Multiple start events**: `addStartEvent()` creates disconnected start events for parallel paths
- **Boundary events**: `boundaryEvent(id, options)` attached to activities with error/timer/message/signal support
- **Event definitions**: Timer (duration/date/cycle), message, signal, escalation on start/intermediate/boundary events
- **Ad-hoc sub-process**: `activeElementsCollection` and `loopCharacteristics` with full zeebe extension support
- **Modeler template**: `modelerTemplate`, `modelerTemplateVersion`, `modelerTemplateIcon` on service tasks
- **Version tag**: `versionTag(tag)` on process
- **`build()` returns `BpmnDefinitions`** (not just `BpmnProcess`) with full namespace declarations
- **Aspirational elements**: inclusive gateway, event-based gateway, sub-process, event sub-process, send/receive tasks
- Added `BpmnMessageEventDefinition` and `BpmnSignalEventDefinition` to model types
- Updated `src/index.ts` exports for all new option types
- 52 builder tests covering all features including 9-branch fan-out pattern
- Fixed existing tests (rest-connector, roundtrip) for new `build()` return type
- All 226 tests pass, zero lint errors, zero build warnings

### BPMN Builder Unit Tests (52 tests)
- Extended BPMN model with aspirational types: `sendTask`, `receiveTask`, `eventSubProcess`, `BpmnSubProcess`, `BpmnInclusiveGateway`, `BpmnEventBasedGateway`
- Rewrote `ProcessBuilder` with full gateway support: exclusive, parallel, inclusive, event-based
- Added `branch(name, callback)` pattern with `BranchBuilder` for gateway fan-out
- Added `connectTo(targetId)` for merge points and loop patterns
- Added sub-process builders: `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with `SubProcessContentBuilder`
- Added multi-instance configuration (parallel/sequential) with Zeebe extension elements
- Added aspirational element builders: `sendTask()`, `receiveTask()`, `businessRuleTask()`
- Added `recomputeIncomingOutgoing()` to fix up incoming/outgoing arrays at build time
- 52 comprehensive tests covering: linear flow, all validated element types, all aspirational types, exclusive gateway (2-branch and 9-branch fan-out), parallel gateway (2 and 3 branches), inclusive gateway, event-based gateway, loops via connectTo, ad-hoc sub-processes with multi-instance, sub-processes, event sub-processes, boundary events, error handling, complex nested patterns

### BPMN Parser/Serializer Lint Cleanup
- Fixed 14 `noNonNullAssertion` lint errors in `bpmn-roundtrip.test.ts`
- Added bounds-checked `at()` helper to replace `arr[i]!` patterns
- Replaced `find()!` with proper `undefined` checks and early returns
- All 226 tests pass, zero lint errors, zero build warnings

### REST Connector Convenience Builder
- Implemented `restConnector(id, config)` as syntactic sugar on `ProcessBuilder`
- Generates `io.camunda:http-json:1` service tasks with proper Zeebe extensions
- Supports GET/POST/PATCH/PUT/DELETE methods, bearer/noAuth authentication
- IO mapping inputs: method, url, authentication, body, headers, queryParameters, timeouts
- Task headers: resultVariable, resultExpression, retryBackoff (only when configured)
- Headers and queryParameters accept both FEEL strings and Record<string, string> (auto-serialized)
- 16 tests covering all patterns including real-world GitHub API example
- Fixed tests to work with updated `build()` return type (`BpmnDefinitions`)

## 2026-02-18

### QA Fixes
- Fixed duplicate `message`/`signal` switch cases in `bpmn-serializer.ts` (caused build failure)
- Fixed sub-process child node positioning in layout engine — children now correctly track parent shifts after `reassignXCoordinates`
- Auto-formatted `bpmn-serializer.ts` with Biome

### Roundtrip Tests for All Example Files
- Fixed build errors in BPMN builder and layout modules (model type alignment)
- Verified Vitest roundtrip tests for all 34 example files (30 BPMN, 1 DMN, 3 Form)
- BPMN roundtrip: parse → serialize → re-parse → deep model comparison (BpmnDefinitions)
- DMN roundtrip: parse → export → re-parse → field-level comparison (DmnDefinitions)
- Form roundtrip: parse → export → re-parse → deep equality (FormDefinition)
- XML-level roundtrip: parse → serialize → re-parse → structural comparison (XmlElement tree)
- All 169 roundtrip-related tests pass

### BPMN Support
- Added BPMN model types (`BpmnDefinitions`, `BpmnProcess`, `BpmnFlowElement` discriminated union, DI types)
- Added BPMN XML parser (`Bpmn.parse()`) with support for all element types in examples
- Added BPMN XML serializer (`Bpmn.export()`) with namespace-aware reconstruction
- Added `Bpmn.createProcess()` fluent builder with service tasks, script tasks, user tasks, call activities, REST connector sugar
- Added Form model types, parser (`Form.parse()`), serializer (`Form.export()`), and builder
- Added auto-layout engine (Sugiyama/layered algorithm with sub-process support)

### DMN Support
- Added DMN model types (`DmnDefinitions`, `DmnDecision`, `DmnDecisionTable`, `DmnInput`, `DmnOutput`, `DmnRule`)
- Added generic XML parser/serializer using `fast-xml-parser` with namespace-aware roundtrip support
- Added DMN XML parser (`Dmn.parse()`)
- Added DMN XML serializer (`Dmn.export()`)
- Added `Dmn.createDecisionTable()` fluent builder with:
  - Input columns (label, expression, typeRef)
  - Output columns (label, name, typeRef) — multi-output support
  - Rules with input/output entries and descriptions
  - All 7 hit policies (UNIQUE, FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY)
  - Auto-generated diagram shapes
  - XML export via `.toXml()`
- Added shared `XmlElement` type for opaque extension element preservation
- Added roundtrip test against `Github>Slack users.dmn` (2-output table, 21 rules)
- Set up monorepo infrastructure (pnpm, Turborepo, Biome, Vitest, TypeScript strict)
