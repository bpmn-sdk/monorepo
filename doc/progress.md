# Progress

## 2026-02-26 — Editor Integration: Multi-file Import + Tabs

### `apps/landing` — editor.ts
- **`InMemoryFileResolver`** created and shared between the tabs plugin and the config panel bpmn callbacks
- **`createTabsPlugin`** added to the editor plugin stack with `onTabActivate` wired to `editor.load(xml)` for BPMN tabs
- **`createConfigPanelBpmnPlugin`** now receives `openDecision` and `openForm` callbacks that delegate to `tabsPlugin.api.openDecision/openForm`
- **Multi-file import via menu** — "Import files…" entry in the main-menu dropdown opens a `<input type="file" multiple>` accepting `.bpmn`, `.xml`, `.dmn`, `.form`, `.json`; each file is parsed and opened in its own tab
- **Drag-and-drop** — `dragover`/`drop` handlers on `#editor-container` accept dropped files; same parsing and tab-opening logic
- `.bpmn`/`.xml` → BPMN tab (loaded into the editor via `onTabActivate`); `.dmn` → DMN tab (registered in resolver); `.form`/`.json` → Form tab (registered in resolver)

### `canvas-plugins/main-menu` — menuItems extension
- **`menuItems?: MenuItem[]`** added to `MainMenuOptions`; supports `MenuAction` (label + optional icon + onClick) and `MenuSeparator`
- Custom items render above the Theme section with an automatic separator; theme section wrapped in a `display:contents` div so `buildThemeItems` rebuilds only that portion
- **`.bpmn-menu-drop-sep`** CSS added for the separator rule

### `canvas-plugins/tabs` — onTabActivate + transparent BPMN panes
- **`onTabActivate?: (id, config) => void`** added to `TabsPluginOptions`; called in `setActiveTab` after the tab is made active
- **BPMN panes** are now empty (no text note) and transparent — the main canvas SVG shows through
- **`pointer-events: none`** applied to the content area when a BPMN tab is active so the canvas remains fully interactive; restored when a DMN/Form tab is active

## 2026-02-26 — DMN Viewer, Form Viewer, Tabs Plugin, Extended Core Model

### `@bpmn-sdk/core` — Zeebe extensions + full Form component set
- **`ZeebeFormDefinition`** and **`ZeebeCalledDecision`** typed interfaces added to `zeebe-extensions.ts`; `ZeebeExtensions` grows `formDefinition?` and `calledDecision?` fields; `zeebeExtensionsToXmlElements` serialises both
- **`bpmn-builder.ts`** updated: `userTask()` now writes `formDefinition: { formId }` and `businessRuleTask()` writes `calledDecision: { decisionId, resultVariable }` using typed fields instead of raw `XmlElement[]`
- **13 new Form component types** — `number`, `datetime`, `button`, `taglist`, `table`, `image`, `dynamiclist`, `iframe`, `separator`, `spacer`, `documentPreview`, `html`, `expression`, `filepicker`
- **`FormUnknownComponent`** catch-all added; parser now handles unknown types leniently instead of throwing
- `form-serializer.ts` updated to handle all component types via explicit type assertions (workaround for discriminated union narrowing issue with catch-all type)
- All new types exported from `packages/bpmn-sdk/src/index.ts`

### `canvas-plugins/dmn-viewer` — New package `@bpmn-sdk/canvas-plugin-dmn-viewer`
- **`DmnViewer` class** — `load(defs)`, `clear()`, `setTheme()`, `destroy()`; renders `DmnDefinitions` as an HTML decision table with hit policy badge
- **FEEL syntax highlighting** — `tokenizeFeel()` / `highlightFeel()` tokenize FEEL expressions into keyword, string, number, operator, range, function, comment spans; colored via CSS custom properties
- **Light/dark themes** — CSS custom properties; `setTheme("light"|"dark"|"auto")`; auto follows `prefers-color-scheme`
- **`createDmnViewerPlugin(options)`** — thin `CanvasPlugin` wrapper; responds to `element:click` on call activities referencing a decision via `zeebe:calledDecision`

### `canvas-plugins/form-viewer` — New package `@bpmn-sdk/canvas-plugin-form-viewer`
- **`FormViewer` class** — `load(form)`, `clear()`, `setTheme()`, `destroy()`; renders all 21 `FormComponent` types
- **Row-based grid layout** — components grouped by `layout.row`; side-by-side rendering within a row
- **All 21 component types rendered** — textfield, textarea, number, datetime, select, radio, checkbox, checklist, taglist, button, group, dynamiclist, table, image, iframe, separator, spacer, documentPreview, html, expression, filepicker, and unknown passthrough
- **Minimal markdown** — `text` components support `#`/`##` headers, `**bold**`, `_italic_`
- **`createFormViewerPlugin(options)`** — thin `CanvasPlugin` wrapper; responds to `element:click` on user tasks with a `zeebe:formDefinition`

### `canvas-plugins/tabs` — New package `@bpmn-sdk/canvas-plugin-tabs`
- **`FileResolver` interface** — `resolveDmn(decisionId)`, `resolveForm(formId)`, `resolveBpmn(processId)`; pluggable abstraction for in-memory, file system, or SaaS backends
- **`InMemoryFileResolver`** — default implementation using Maps; `registerDmn(defs)` / `registerForm(form)` / `registerBpmn(id, xml)` to populate at runtime
- **Tab bar overlay** — fixed overlay inside the canvas container; tabs for BPMN/DMN/Form files; close button per tab; active tab highlighted
- **`TabsApi`** — `openTab()`, `closeTab()`, `setActiveTab()`, `getActiveTabId()`, `getTabIds()`, `openDecision(decisionId)`, `openForm(formId)` public API
- **Warning badge** — shown when referenced file is not found in the file resolver registry
- **`createTabsPlugin(options)`** — factory returning `CanvasPlugin & { api: TabsApi }`

### `canvas-plugins/config-panel` + `config-panel-bpmn` — Typed userTask/businessRuleTask panels
- **`"action"` FieldType** added to `config-panel`; `FieldSchema.onClick` callback invoked when the action button is clicked
- **`.bpmn-cfg-action-btn`** button styles added (light and dark themes)
- **`makeUserTaskSchema(onOpenForm?)`** — config panel schema for user tasks: `formId` text field + conditional "Open Form ↗" action button
- **`USER_TASK_ADAPTER`** — reads/writes `zeebe:formDefinition/@formId` via typed `ext.formDefinition`
- **`makeBusinessRuleTaskSchema(onOpenDecision?)`** — schema for business rule tasks: `decisionId`, `resultVariable` fields + conditional "Open Decision ↗" action button
- **`BUSINESS_RULE_TASK_ADAPTER`** — reads/writes `zeebe:calledDecision` via typed `ext.calledDecision`
- **`ConfigPanelBpmnOptions`** — `openDecision?` and `openForm?` callback options on the plugin factory
- `createConfigPanelBpmnPlugin(configPanel, options?)` registers userTask and businessRuleTask with their specific schemas
- `parseZeebeExtensions` in `util.ts` updated to parse `formDefinition` and `calledDecision` extension elements

## 2026-02-26 — Landing Page Editor Link + Mobile Editor Responsiveness

### `apps/landing` — Editor discoverability
- **"Try the Editor →" button** added to hero section with a gradient `btn-editor` style (accent → green)
- **Footer link** to `/editor` added alongside GitHub and npm links

### `@bpmn-sdk/editor` — Collapsible HUD toolbars on mobile (≤600px)
- **Bottom-center toolbar** (`#hud-bottom-center`) starts collapsed on mobile; tapping the toggle button expands it to full width; auto-collapses after selecting any tool or element group
- **Top-center toolbar** (`#hud-top-center`) same pattern; auto-collapses after undo/redo/delete/duplicate
- Toggle button icons update to reflect the currently active tool (bottom-center) or show the undo icon (top-center)
- Tapping outside an expanded toolbar collapses it; expanding one collapses the other
- Desktop layout unchanged — toggle buttons hidden via CSS media query

## 2026-02-25 — SubProcess Containment + Sticky Movement

### `@bpmn-sdk/editor` — Container-aware modeling operations

- **Sticky movement** — moving an `adHocSubProcess` (or any subprocess/transaction) also moves all descendant DI shapes; edge waypoints for flows inside or connected to the subprocess are updated correctly using a new `collectAllSequenceFlows` helper that searches all nesting levels
- **Containment on create** — when a new shape is dropped inside a subprocess's DI bounds, `createShape` detects the innermost container via `findContainerForPoint` and nests the new `BpmnFlowElement` inside it via `addToContainer`; the DI shape is always added flat to `diagram.plane.shapes`
- **Cascade delete** — deleting a subprocess recursively collects all descendant element and flow IDs via `collectDescendantIds`, then `removeFromContainers` removes them from all nesting levels; DI shapes and edges for descendants are also removed
- **Recursive label update** — `updateLabel` now uses `updateNameInElements` which searches all nesting levels; renaming a task inside a subprocess now works
- **Recursive incoming/outgoing update** — `createConnection` now uses `updateRefInElements` so connecting subprocess-child elements correctly updates their `incoming`/`outgoing` refs

## 2026-02-25 — Agentic AI Subprocess Support

### `@bpmn-sdk/core` — `ZeebeAdHoc` typed interface
- **`ZeebeAdHoc`** interface added to `zeebe-extensions.ts`: `outputCollection`, `outputElement`, `activeElementsCollection` fields
- **`ZeebeExtensions.adHoc`** field added; `zeebeExtensionsToXmlElements` now serialises `zeebe:adHoc` element when present

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Full AI Agent template support
- **`TemplateBinding`** union extended with `{ type: "zeebe:adHoc"; property: "outputCollection" | "outputElement" | "activeElementsCollection" }` in `template-types.ts`
- **`getPropertyKey`** handles `zeebe:adHoc` → `adHoc.${property}` key
- **`readPropertyValue`** reads `zeebe:adHoc` attributes via `getAdHocAttr(el.extensionElements, property)`; `el` parameter widened to include `extensionElements`
- **`applyBinding`** accepts new `adHocProps` accumulator; populates it for `zeebe:adHoc` bindings
- **Template engine `write`**: adds `"adHoc"` to `ZEEBE_LOCAL` set (prevents duplicate elements); passes `adHocProps` to `zeebeExtensionsToXmlElements` → produces correct `<zeebe:adHoc outputCollection="toolCallResults" outputElement="..."/>` in the XML
- **`getAdHocAttr`** helper added to `util.ts`
- **`ADHOC_SUBPROCESS_TEMPLATES`** — filters `CAMUNDA_CONNECTOR_TEMPLATES` to templates that apply to `bpmn:SubProcess` (including `io.camunda.connectors.agenticai.aiagent.jobworker.v1`)
- **`ADHOC_OPTIONS`** dropdown — "Custom" + all ad-hoc subprocess templates, sorted alphabetically
- **`GENERIC_ADHOC_SCHEMA` + `ADHOC_SUBPROCESS_ADAPTER`** — template-aware config panel for `adHocSubProcess`; `resolve()` hook delegates to the AI Agent template registration when `zeebe:modelerTemplate` is set; `write()` stamps `zeebe:modelerTemplate` and delegates to template adapter; clearing sets connector to "" and removes all modelerTemplate attributes
- **`adHocSubProcess`** registered in `createConfigPanelBpmnPlugin.install()`
- **6 new tests** in `index.test.ts` covering registration, read/write, resolve, template delegation, and clearing

### `@bpmn-sdk/editor` — Ad-hoc subprocess as a creatable element
- **`CreateShapeType`**: `"adHocSubProcess"` added to the union
- **`RESIZABLE_TYPES`**: `"adHocSubProcess"` added
- **`ELEMENT_TYPE_LABELS`**: `adHocSubProcess: "Ad-hoc Sub-Process"` added
- **`ELEMENT_GROUPS`**: `"adHocSubProcess"` added to the Activities group (after `subProcess`, before `transaction`)
- **`makeFlowElement`**: `case "adHocSubProcess"` — creates element with empty `flowElements`, `sequenceFlows`, `textAnnotations`, `associations`
- **`changeElementType`**: `case "adHocSubProcess"` — preserves child contents when changing to/from ad-hoc subprocess
- **`defaultBounds`**: `"adHocSubProcess"` added alongside `"subProcess"` and `"transaction"` — 200×120 px
- **`icons.ts`**: `adHocSubProcess` SVG icon added (rounded rect + tilde wave marker, matches BPMN standard notation)

## 2026-02-25 — Config Panel: Template Adapter Bug Fix + Required Field Indicators

### `@bpmn-sdk/canvas-plugin-config-panel` — Bug fix + required field UI
- **Bug**: `_applyField` was always using the base registered adapter (`this._schemas.get(type)`) instead of `this._effectiveReg` (the template-resolved adapter). The generic `SERVICE_TASK_ADAPTER.write()` explicitly strips `zeebe:modelerTemplate`, causing the template panel to revert to the generic service task form whenever a field was changed while a connector template was active. Fixed by resolving `effective = this._effectiveReg ?? reg` and using `effective.adapter.write()` + `effective.schema` in `_applyField`.
- **Feature**: Required field visual indication — `FieldSchema` gains an optional `required?: boolean` field; when set, a red asterisk (`*`) is shown next to the label and the input/select/textarea gets a red border when empty. Validation state is refreshed on every field change and on diagram reload.
- **`_refreshValidation(schema)`** — new method that toggles `.bpmn-cfg-field--invalid` on field wrappers for required fields with empty values; called from `_applyField` and `onDiagramChange`.
- **`FIELD_WRAPPER_ATTR`** now stamped on every field wrapper (not just conditional ones) so both `_refreshConditionals` and `_refreshValidation` can query by key.
- **CSS**: `.bpmn-cfg-required-star` (red `#f87171`) and `.bpmn-cfg-field--invalid` border style added to `css.ts`.

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Propagate `required` from templates
- **`propToFieldSchema`** — sets `required: true` on the generated `FieldSchema` when `prop.constraints?.notEmpty === true`; all Camunda connector template fields marked `notEmpty` now show the required indicator in the config panel.

## 2026-02-25 — Connector Template Icons Rendered in Canvas

### `@bpmn-sdk/canvas` — Template icon rendering
- **`renderer.ts`** — `renderTask()` checks `el.unknownAttributes["zeebe:modelerTemplateIcon"]`; if present, renders an SVG `<image>` element (14×14 at position 4,4) with `href` set to the data URI instead of the hardcoded gear icon; standard task type icons are unaffected
- **1 new test** in `canvas.test.ts`: verifies `<image>` is rendered and gear icon circles are absent when `modelerTemplateIcon` is set

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Stamp icon on template apply
- **`template-engine.ts`** — `adapter.write()` now includes `zeebe:modelerTemplateIcon` in `unknownAttributes` when the template has `icon.contents`; icon is persisted to the BPMN element whenever a connector template is applied via the UI

## 2026-02-25 — Connector Templates Usable via Core Builder

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — `templateToServiceTaskOptions`
- **`templateToServiceTaskOptions(template, values)`** — converts any `ElementTemplate` + user-provided values into `ServiceTaskOptions` for the core `Bpmn` builder; applies Hidden property defaults and user values to zeebe bindings
- **`CAMUNDA_CONNECTOR_TEMPLATES`** — now exported from the package public API
- **3 new tests** in `tests/template-to-service-task.test.ts`: Kafka connector options, full Bpmn build integration, REST connector template defaults

## 2026-02-25 — Camunda Connector Templates: Fetch, Generate, Integrate

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — All 116 Camunda connectors
- **`scripts/update-connectors.mjs`** — new script that fetches all OOTB connector templates from the Camunda marketplace (`marketplace.cloud.camunda.io/api/v1/ootb-connectors`), resolves each template's `ref` URL, and writes `canvas-plugins/config-panel-bpmn/src/templates/generated.ts` with all templates as a typed array
- **`pnpm update-connectors`** — root-level script to regenerate `generated.ts` at any time
- **`generated.ts`** excluded from Biome linting (`biome.json` `files.ignore`)
- **116 connector templates** registered in `TEMPLATE_REGISTRY` at startup (all OOTB Camunda connectors: REST, Slack, Salesforce, ServiceNow, GitHub, Twilio, AWS, Azure, Google, WhatsApp, Facebook, etc.)
- **Connector selector** shows all 116 service-task connectors (one entry per template id, no collisions even when multiple connectors share the same underlying task type)
- **Write path** accepts template id directly from CONNECTOR_OPTIONS, with backward-compat fallback to task type → template id map
- **`TASK_TYPE_TO_TEMPLATE_ID`** built with first-wins per task type for backward-compat detection
- **Deleted `rest-connector.ts`** — hand-written REST template superseded by `generated.ts`

## 2026-02-25 — Element Templates System + REST Connector Template

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Template-aware property panel
- **Element template types** — `ElementTemplate`, `TemplateProperty`, `TemplateBinding`, `TemplateCondition` TypeScript types matching the Camunda element templates JSON schema
- **Template engine** — `buildRegistrationFromTemplate(template)` converts any element template descriptor into a `PanelSchema` + `PanelAdapter` pair; handles all binding types (`zeebe:input`, `zeebe:taskHeader`, `zeebe:taskDefinition`), condition types (`equals`, `oneOf`, `allMatch`), and property types (`String`, `Text`, `Dropdown`, `Boolean`, `Number`, `Hidden`)
- **REST Outbound Connector template** — official Camunda template (`io.camunda.connectors.HttpJson.v2`, version 12) bundled as TypeScript; covers all 8 groups: Authentication (noAuth/apiKey/basic/bearer/OAuth 2.0), HTTP endpoint, Timeout, Payload, Output mapping, Error handling, Retries
- **Dynamic schema resolution** — `PanelAdapter.resolve?()` mechanism: when `zeebe:modelerTemplate` attribute is detected on an element (or inferred from known task type), the panel switches to the template-specific form automatically
- **Template application** — selecting a connector in the generic service task form stamps `zeebe:modelerTemplate` + delegates all field writes to the template adapter (including template-specific fields like URL, method, auth)
- **`registerTemplate(template)`** — public API on the plugin for registering additional element templates at runtime
- **`TEMPLATE_ID_TO_TASK_TYPE` / `TASK_TYPE_TO_TEMPLATE_ID`** maps for bidirectional connector detection
- **Backward compatibility** — elements with known task definition types (e.g. `io.camunda:http-json:1`) but without `zeebe:modelerTemplate` are still detected and shown with the correct template form

### `@bpmn-sdk/canvas-plugin-config-panel` — Dynamic registration
- **`PanelAdapter.resolve?(defs, id)`** — optional method that overrides the schema+adapter for a specific element instance; renderer calls it on every select and diagram-change event
- **Re-render on schema change** — when `resolve?` returns a different registration (e.g. template applied), the compact/full panel re-renders automatically without requiring a manual re-select

### `@bpmn-sdk/core` — Builder
- **`restConnector()` stamps `zeebe:modelerTemplate`** — builder now sets `zeebe:modelerTemplate: "io.camunda.connectors.HttpJson.v2"` and `zeebe:modelerTemplateVersion: "12"` on the element; programmatically generated BPMN is now recognized by the editor's template panel

## 2026-02-25 — Intermediate Event Subgroups, Boundary Events, Ghost Fix

### `@bpmn-sdk/editor` — Event system overhaul
- **3 event subgroups** — single "Events" palette group replaced with `startEvents` (5 types), `endEvents` (7 types), `intermediateEvents` (10 types)
- **20 new `CreateShapeType` values** — one per BPMN event variant: `messageStartEvent`, `timerStartEvent`, `conditionalStartEvent`, `signalStartEvent`; `messageEndEvent`, `escalationEndEvent`, `errorEndEvent`, `compensationEndEvent`, `signalEndEvent`, `terminateEndEvent`; `messageCatchEvent`, `messageThrowEvent`, `timerCatchEvent`, `escalationThrowEvent`, `conditionalCatchEvent`, `linkCatchEvent`, `linkThrowEvent`, `compensationThrowEvent`, `signalCatchEvent`, `signalThrowEvent`
- **`makeFlowElement` / `changeElementType`** — all 20 new types map to the correct BPMN base type (`startEvent`, `endEvent`, `intermediateCatchEvent`, `intermediateThrowEvent`) with the right `eventDefinitions` entry
- **Type-switch restriction** — types can only change within their subgroup: start events ↔ start events, end ↔ end, intermediate ↔ intermediate (enforced by group membership)
- **`getElementType` resolution** — returns specific palette type (e.g. `"messageCatchEvent"`) by inspecting `eventDefinitions[0]`; cfg toolbar highlights the correct active variant
- **Boundary events** — creating any intermediate event type while hovering over an activity shows a dashed blue highlight on the host; on click, a `boundaryEvent` is created attached to that activity at the cursor's nearest boundary point; `cancelActivity = true` by default
- **`createBoundaryEvent(defs, hostId, eventDefType, bounds)`** — new modeling function; creates `BpmnBoundaryEvent` in `process.flowElements` + DI shape
- **`moveShapes` cascade** — moving an activity automatically also moves its attached boundary events
- **`deleteElements` cascade** — deleting an activity also deletes its attached boundary events
- **Ghost shape preview fix** — `overlay.ts::setGhostCreate` now renders correct shape per type: thin circle (start), thick circle (end), double ring (intermediate), diamond (gateway), bracket (annotation), rounded rect (activities)
- **`defaultBoundsForType` in overlay.ts** — fixed to cover all event and gateway types (36×36 for events, 50×50 for gateways)
- **Escape key to cancel** — canvas host is now focused when entering create mode, ensuring Escape key correctly cancels creation
- **39 element commands** — command palette and shape palette now cover all BPMN element variants (was 21, now 39)

## 2026-02-25 — Full BPMN Element Type Coverage

### `@bpmn-sdk/core` — New model types
- **`BpmnTask`**, **`BpmnManualTask`**, **`BpmnTransaction`**, **`BpmnComplexGateway`** — new flow element interfaces added to the discriminated union
- **`BpmnLane`**, **`BpmnLaneSet`** — swimlane hierarchy; `BpmnProcess.laneSet` optional field
- **`BpmnMessageFlow`** — inter-pool communication; `BpmnCollaboration.messageFlows` array
- **New event definitions** — `BpmnConditionalEventDefinition`, `BpmnLinkEventDefinition`, `BpmnCancelEventDefinition`, `BpmnTerminateEventDefinition`, `BpmnCompensateEventDefinition`; all added to `BpmnEventDefinition` union
- **Parser** — full parse support for all new types including `parseLaneSet`, `parseLane`, `parseMessageFlow`; `compensation` → `compensate` event def rename
- **Serializer** — full serialize support for all new types; `serializeLaneSet`, `serializeLane`, `serializeMessageFlow`
- **Builder** — `makeFlowElement` extended with task, manualTask, complexGateway, transaction cases

### `@bpmn-sdk/canvas` — New renderers
- **Pool/lane rendering** — `renderPool` and `renderLane` produce container rects with rotated title bars; `ModelIndex` now indexes `participants` and `lanes` maps
- **Message flow rendering** — dashed inter-pool arrows rendered in the edge loop via `messageFlowIds` Set
- **Non-interrupting boundary events** — dashed inner ring via new `.bpmn-event-inner-dashed` CSS class when `cancelActivity === false`
- **Transaction** — double inner border rect inside the task body
- **New event markers** — conditional (document icon), link (arrow), cancel (X), terminate (filled circle); `compensation` renamed to `compensate`
- **New gateway marker** — complexGateway asterisk (diagonal + cross paths)
- **New task icon** — manualTask (hand SVG path)

### `@bpmn-sdk/editor` — New creatable types
- **8 new `CreateShapeType` values** — `intermediateThrowEvent`, `intermediateCatchEvent`, `task`, `manualTask`, `callActivity`, `subProcess`, `transaction`, `complexGateway`
- **`RESIZABLE_TYPES`** — task, manualTask, callActivity, subProcess, transaction added
- **`defaultBounds`** — intermediate events 36×36; complexGateway 50×50; subProcess/transaction 200×120
- **Element groups** — events group gains intermediate throw/catch; activities group gains task, manualTask, callActivity, subProcess, transaction; gateways group gains complexGateway
- **Icons** — all 8 new types have dedicated SVG icons
- **`EXTERNAL_LABEL_TYPES`** — intermediateThrowEvent, intermediateCatchEvent, complexGateway added (external label placement)
- **`makeFlowElement` / `changeElementType`** — all 8 new types handled in modeling operations

### `@bpmn-sdk/canvas-plugin-command-palette-editor`
- Updated command count: 21 element creation commands (was 13); test updated accordingly

## 2026-02-25 — Watermark Plugin

### `@bpmn-sdk/canvas-plugin-watermark` (NEW)
- **`createWatermarkPlugin(options?)`** — bottom-right attribution bar; renders configurable links and an optional square SVG logo; logo is always the rightmost element; fully self-contained CSS injection
- **`WatermarkLink`** / **`WatermarkOptions`** interfaces exported
- 7 tests; added to `canvas-plugins/*` workspace

### `@bpmn-sdk/landing` — editor page
- Added watermark plugin with a "Github" link (`https://github.com/bpmn-sdk/monorepo`) and a BPMN-flow square SVG logo (start event → task → end event on blue rounded square)

## 2026-02-25 — Annotation Bug Fixes

### `@bpmn-sdk/canvas`
- **Annotation selection** — added transparent `<rect>` fill covering the full bounding area so the entire annotation rectangle is clickable/draggable
- **Bracket path** — changed from short-stub to full-width open-right bracket (`M w 0 L 0 0 L 0 h L w h`) matching standard BPMN notation
- **Annotation text position** — text now centred in the full shape area (`cx = width/2, cy = height/2, maxW = width - 8`)

## 2026-02-25 — Colors & Text Annotations

### `@bpmn-sdk/core` — `DiColor` helpers
- **NEW `packages/bpmn-sdk/src/bpmn/di-color.ts`** — `DiColor` interface, `readDiColor`, `writeDiColor`, `BIOC_NS`, `COLOR_NS` re-exported from `@bpmn-sdk/core`

### `@bpmn-sdk/canvas` — Color rendering + annotation text
- **`RenderedShape.annotation?: BpmnTextAnnotation`** — annotation object available on rendered shapes
- **Color rendering** — `applyColor(el, shape)` helper reads `bioc:fill`/`bioc:stroke` (+ OMG namespace equivalents) from DI `unknownAttributes` and applies inline `style` on shape bodies (task rect, event outer circle, gateway diamond)
- **Annotation text** — `renderAnnotation` now accepts a `text` param and renders wrapped text inside the bracket
- **Model index** — `buildIndex` now indexes `textAnnotations` from all processes and collaborations

### `@bpmn-sdk/editor` — New tools, color editing, annotation editing
- **`textAnnotation` type** — added to `CreateShapeType`, `ELEMENT_GROUPS` ("Annotations" group), `ELEMENT_TYPE_LABELS`, `RESIZABLE_TYPES`, `defaultBounds`
- **`createAnnotation(defs, bounds, text?)`** — creates a `BpmnTextAnnotation` + DI shape
- **`createAnnotationWithLink(defs, bounds, sourceId, sourceBounds, text?)`** — creates annotation + `BpmnAssociation` + DI edge
- **`updateShapeColor(defs, id, color)`** — writes `bioc:`/`color:` attributes via `writeDiColor`; adds namespaces to definitions
- **`updateLabel`** — extended to update `text` on `BpmnTextAnnotation`
- **`deleteElements`** — cascades to remove linked associations (and their DI edges) when a flow element or annotation is deleted
- **`moveShapes`** — recomputes association edge waypoints when source or target shape moves
- **`editor.createAnnotationFor(sourceId)`** — creates a linked annotation above-right of source; opens label editor
- **`editor.updateColor(id, color)`** — applies color or clears it (pass `{}`)
- **Double-click annotation** — opens label editor via existing `_startLabelEdit` (now reads `textAnnotations.text`)
- **Annotation resize** — `_isResizable`/`_getResizableIds` now include annotation shapes
- **HUD color swatches** — 6 preset color swatches in ctx toolbar for all non-annotation flow elements; clicking active swatch clears the color
- **HUD annotation button** — "Add text annotation" button in ctx toolbar creates a linked annotation

## 2026-02-25

### `@bpmn-sdk/canvas-plugin-config-panel` + `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Connector selector
- **`FieldSchema.condition`** — new optional field; hides a field when the predicate returns false, mirroring the existing `GroupSchema.condition` at the individual-field level
- **`ConfigPanelRenderer._refreshConditionals`** — new method updates both field-level and group/tab visibility; called synchronously from `_applyField` (immediate UI) and `onDiagramChange` (after external model update)
- **Service task "Connector" selector** — replaces the raw `taskType` text input with a `connector` select dropdown:
  - `""` → **Custom** — shows a `taskType` text field for the Zeebe job type string
  - `"io.camunda:http-json:1"` → **REST Connector** — hides the task-type field; shows Request / Authentication / Output tab groups
- **Adapter logic** — `read()` derives `connector` value from `taskDefinition.type`; `write()` only emits REST ioMapping / taskHeaders when REST connector is selected (switching to Custom clears REST-specific extensions)
- **4 new tests** in `canvas-plugins/config-panel-bpmn/tests/index.test.ts`

## 2026-02-24

### Config panel fixes (round 2)

- **z-index**: Overlay and compact panel both raised to `z-index: 9999` — always above HUD toolbars
- **Centering**: When the full panel opens, the selected element is panned to the horizontal/vertical center of the left 35% darkened area (preserving zoom). Closing the panel re-centers the element at the global screen center
- **Tabs**: Section navigation replaced with proper underline tabs; only one group's content is visible at a time; active tab highlighted in blue; switching tabs is instant (show/hide, no DOM rebuild)
- **Conditional REST fields**: Service task REST connector groups (Request, Authentication, Output) are now hidden by default and only shown when `taskType === "io.camunda:http-json:1"`; tabs for hidden groups also disappear; if the active tab becomes hidden (e.g. clearing the task type), the first visible tab is auto-activated
- `GroupSchema.condition?: (values) => boolean` — new optional field to conditionally show/hide groups and their tabs

### Config panel plugins

Two new canvas plugin packages for schema-driven element property editing:

- **`@bpmn-sdk/canvas-plugin-config-panel`** — core infrastructure
  - `createConfigPanelPlugin({ getDefinitions, applyChange })` factory
  - `ConfigPanelPlugin` extends `CanvasPlugin` with `registerSchema(type, schema, adapter)`
  - Schema-driven rendering: `FieldSchema` (text, select, textarea, toggle), `GroupSchema`, `PanelSchema`
  - `PanelAdapter` interface: `read(defs, id) → values`, `write(defs, id, values) → BpmnDefinitions`
  - Compact panel: `position: fixed; right: 12px; top: 12px; width: 280px` dark glass panel shown when 1 element is selected
  - Full overlay: 65%-width right panel with dimmed backdrop, tab navigation between groups, full form
  - Auto-save on field `change` event; `_refreshInputs()` updates values in-place without re-render (preserves focus)
  - Subscribes to `editor:select` and `diagram:change` via `api.on` type cast

- **`@bpmn-sdk/canvas-plugin-config-panel-bpmn`** — BPMN element schemas
  - Registers general schema (name + documentation) for: startEvent, endEvent, userTask, scriptTask, sendTask, receiveTask, businessRuleTask, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway
  - Full REST connector form for serviceTask: General (name, taskType, retries, documentation), Request (method, url, headers, queryParameters, body, timeouts), Authentication (authType, authToken), Output (resultVariable, resultExpression, retryBackoff)
  - Zeebe extension parsing and serialization via `parseZeebeExtensions` / `zeebeExtensionsToXmlElements`
  - Immutable `updateFlowElement(defs, id, fn)` helper for model updates

- **`BpmnEditor`** — added `getDefinitions()` and `applyChange(fn)` public methods
- **`@bpmn-sdk/core`** — now exports `zeebeExtensionsToXmlElements`
- Both plugins integrated in `apps/landing` with full keyboard/event wiring

### Zen mode: view-only restriction

- Added `BpmnEditor.setReadOnly(enabled: boolean)` public method
- When enabled: clears the current selection and all in-progress overlays, forces the state machine into pan mode
- When disabled: restores select mode via `setTool("select")` (emits `editor:tool` event so HUD updates)
- Four guard points prevent any editing action while read-only:
  - `setTool` — returns early so tool cannot be changed from outside
  - `_executeCommand` — no-ops all diagram mutations (move, resize, delete, connect, paste, etc.)
  - `_startLabelEdit` — prevents the label editor from opening
  - `_onKeyDown` — blocks Ctrl+Z/Y/C/V/A and all state-machine keyboard shortcuts
- Pan and zoom (wheel + pointer drag) continue to work through the viewport controller and pan-mode state machine
- Wired in `apps/landing/src/editor.ts`: `onZenModeChange` now calls `editorRef?.setReadOnly(active)` alongside hiding the HUD elements

### Editor improvements (round 3)

#### Smart placement for contextual toolbar "add connected element"
- `addConnectedElement` now uses `_smartPlaceBounds` to pick the best free direction instead of always placing to the right
- Priority order: **right → bottom → top**
- Skips directions that already have an outgoing connection from the source (e.g., gateways that already have a branch going right use bottom/top instead)
- Skips positions that would overlap any existing element (10 px margin)
- If all three default positions are blocked, increases the vertical gap in 60 px steps (up to 6×) for bottom/top until a clear spot is found
- Fallback: very large rightward gap if all attempts fail
- New private method `_overlapsAny(bounds)` — simple AABB overlap check with margin
- Fixed: `inclusiveGateway` and `eventBasedGateway` now correctly get 50×50 dimensions (was previously only exclusive/parallel)

#### Distance arrows with spacing magnet snap
- During element move, equal-spacing positions between elements now snap (magnet) and show orange distance arrows
- New `_computeSpacingSnap(dx, dy)` method: detects all pairs of static shapes with a horizontal or vertical gap; if the moving element is within the snap threshold of the same gap distance, snaps to that equal-spacing position
- Horizontal snap: checks if moving element can be placed to the right of B or left of A with the same gap as A↔B
- Vertical snap: checks if moving element can be placed below B or above A with the same gap as A↔B
- `_previewTranslate` now combines alignment snap and spacing snap per axis, preferring the one requiring the smaller adjustment; spacing wins when it fires and alignment does not (or spacing is closer)
- Distance guides rendered as orange lines with perpendicular tick marks at each end (`bpmn-dist-guide` CSS class, `#f97316`)
- `OverlayRenderer.setDistanceGuides(guides)` — new method rendering H/V guide segments with tick caps into a dedicated `_distG` group
- Distance guides are cleared on cancel and commit (alongside alignment guides)

### Editor improvements (round 2)

#### Ghost preview: edge-drop highlight during create
- When the ghost element's center hovers over an existing sequence flow, the edge changes to the split-highlight color (indicating the element will be inserted into that edge on click)
- New `_findCreateEdgeDrop(bounds)` method — same proximity check as the drag-move edge drop
- New `_setCreateEdgeDropHighlight(edgeId)` method — uses existing `.bpmn-edge-split-highlight` CSS class
- `_doCreate` uses `insertShapeOnEdge` when a target edge is highlighted, same as drag-move commit

#### Ghost preview + move: magnet alignment guides
- Create mode: ghost element snaps to alignment guides from existing shapes before placement
  - New `_computeCreateSnap(bounds)` — finds closest alignment in x/y within 8/scale px threshold
  - New `_computeCreateGuides(bounds)` — generates alignment guide lines at matched coordinates
  - `_ghostSnapCenter` stores the snapped center; `_doCreate` uses it as the actual placement point
- Regular move: alignment guides now also compare against the dragging element's **original position** (virtual ghost)
  - `_computeSnap` and `_computeAlignGuides` add original bounds of moving shapes to the static reference set
  - A guide appears when the element aligns with where it started, letting users precisely return to the original spot

#### New connections: L-style routing (one bend instead of two)
- `computeWaypoints` in `geometry.ts` rewritten to pick ports based on relative direction instead of always exiting right/entering left
- `absDx >= absDy`: exits right/left, enters top/bottom (L-shape) unless same height (straight)
- `absDy > absDx`: exits bottom/top, enters left/right (L-shape) unless same X (straight vertical)
- Gateways below/above the source automatically use the bottom/top port instead of the right port
- Affects new connections, contextual toolbar "add connected element", edge-split insertion, and connection preview

### Editor improvements

#### Ghost/preview on element creation
- When a create tool is active (e.g. `create:serviceTask`), moving the mouse now shows a translucent shape preview following the cursor
- Implemented by calling `overlay.setGhostCreate(mode.elementType, diag)` in `_onPointerMove` whenever the state machine is in create mode
- Ghost is cleared on commit (`_doCreate`) and on cancel/tool-switch (`setTool`)
- Escape key already cancelled create mode; ghost now also disappears on Escape

#### Orthogonal connection preview
- The connection ghost line during arrow drawing is now orthogonal (H/V/L/Z segments) instead of a diagonal straight line
- `overlay.setGhostConnection()` signature changed from `(src: BpmnBounds, end: DiagPoint)` to `(waypoints: BpmnWaypoint[] | null)` — rendered as a `<polyline>` matching committed edge style
- `previewConnect` callback in `editor.ts` computes waypoints via `computeWaypoints(src, cursor)` before passing to overlay

#### Fix: arrow source port preserved when target is moved
- **Bug**: manually re-routing an arrow's source endpoint would snap back when the target element was moved
- **Cause**: `moveShapes` in `modeling.ts` called `computeWaypoints` (always exits right, enters left) when one endpoint moved, discarding user-set ports
- **Fix**: derive ports from pre-move waypoints using `portFromWaypoint`, then call `computeWaypointsWithPorts` to preserve the user's chosen exit/entry direction while recomputing the route geometry

#### Default theme changed to light
- `apps/landing/src/editor.ts`: `theme: "dark"` → `theme: "light"`

### Refactor: move editor HUD logic to `@bpmn-sdk/editor`
- Extracted all HUD code (~600 lines) from `apps/landing/src/editor.ts` into `packages/editor`
- New `packages/editor/src/icons.ts` — `IC` SVG icon object (internal, not re-exported from index)
- New `packages/editor/src/hud.ts` — `initEditorHud(editor: BpmnEditor): void` — all group buttons, context/configure toolbars, zoom widget, action bar, dropdown management, keyboard shortcuts
- `@bpmn-sdk/editor` now exports `initEditorHud` from `index.ts`
- `apps/landing/src/editor.ts` reduced to ~75 lines: imports, SAMPLE_XML, plugin setup, `new BpmnEditor(...)`, `initEditorHud(editor)`

### Refactor: move BPMN domain metadata to `@bpmn-sdk/editor`
- Extracted element group taxonomy, display names, external-label types, valid label positions, and contextual-add types into `packages/editor/src/element-groups.ts`
- New exports: `ELEMENT_GROUPS`, `ELEMENT_TYPE_LABELS`, `EXTERNAL_LABEL_TYPES`, `CONTEXTUAL_ADD_TYPES`, `getElementGroup()`, `getValidLabelPositions()`, `ElementGroup` type
- `apps/landing/src/editor.ts` now imports these from `@bpmn-sdk/editor`; no BPMN semantics defined in landing
- `@bpmn-sdk/canvas-plugin-command-palette-editor` derives its 12 commands from `ELEMENT_GROUPS` + `ELEMENT_TYPE_LABELS`; all 4 tests pass

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
