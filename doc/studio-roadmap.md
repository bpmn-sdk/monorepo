# BPMNkit Studio — Implementation Roadmap

> Created: 2026-03-24
> Architecture reference: `doc/studio-plan.md`
> Mark items `[x]` when complete.

---

## Phase 1 — Shell & Foundation

**Goal**: A running app with correct layout, theme, routing, and cluster connection.
No real data yet. This is the skeleton every future phase builds on.

### 1.1 Project scaffold

- [x] Create `apps/studio/` with `package.json` (`@bpmnkit/studio`, private)
- [x] Add `preact`, `preact/compat` as runtime deps
- [x] Add `@preact/signals` as runtime dep (fine-grained reactivity for local state)
- [x] Add `zustand` as runtime dep
- [x] Add `@tanstack/query-core`, `@tanstack/react-query` as runtime deps (compat alias makes "react" → preact)
- [x] Add `wouter` as runtime dep
- [x] Add `lucide-preact` as runtime dep
- [x] Add Tailwind v4, `@tailwindcss/vite` in root `package.json` devDependencies
- [x] Add `vite`, `@vitejs/plugin-react` (will resolve to preact via alias) in root devDeps
- [x] Configure `vite.config.ts`:
  - `resolve.alias`: `react` → `preact/compat`, `react-dom` → `preact/compat`, `react-dom/client` → `preact/compat`
  - Tailwind v4 Vite plugin
  - Dev server port 5174
- [x] Configure `tsconfig.json`: strict mode, `jsx: "react-jsx"`, `jsxImportSource: "preact"`
- [x] Add `apps/studio` to `pnpm-workspace.yaml` if not covered by `apps/*`
- [x] Add `studio` and `studio#dev` tasks to `turbo.json`
- [x] Verify: `pnpm --filter @bpmnkit/studio dev` starts Vite without errors

### 1.2 Tailwind → bpmnkit token mapping

- [x] Create `apps/studio/src/styles/globals.css`:
  - Import Tailwind v4: `@import "tailwindcss"`
  - Import bpmnkit UI tokens: `@import "@bpmnkit/ui/tokens.css"`
  - Map `--bpmnkit-*` to Tailwind CSS variables so `bg-surface`, `text-fg`, `border-border`, `text-accent` etc. work as utility classes
- [x] Define Tailwind theme extension in `vite.config.ts` (v4 CSS-first, no `tailwind.config.ts` needed)
- [x] Verify: a test div with `className="bg-surface text-fg"` shows correct colors in all three themes

### 1.3 Theme system

- [x] Create `apps/studio/src/stores/theme.ts` (Zustand):
  - State: `theme: 'light' | 'dark' | 'neon'`, default `'neon'`
  - Action: `setTheme(t)` — calls `applyTheme(document.documentElement, t)` from `@bpmnkit/ui`, persists to localStorage
  - Hydrate from localStorage on init, fall back to `'neon'`
- [x] Apply `data-theme` attribute to `<html>` on mount and on change
- [x] Create `ThemePicker` component: three-way toggle (☀ / ☾ / ✦), uses theme store
- [x] Verify: switching themes in the UI instantly updates colors, survives reload

### 1.4 App shell layout

- [x] Create `apps/studio/src/layout/Shell.tsx`:
  - Three-column: `Sidebar` (64px, fixed) | `main` (flex-1, overflow-y-auto) | `AIDrawer` (280px, collapsible)
  - AI drawer collapsed by default; state in Zustand `ui` store
  - Keyboard: `⌘J` or `⌘I` toggles AI drawer
- [x] Create `apps/studio/src/layout/Sidebar.tsx`:
  - Icon buttons: Dashboard, Models, Definitions, Instances, Incidents, Tasks, Decisions, Settings
  - Active state from wouter `useRoute`
  - Keyboard nav: `g then d/m/e/i/n/t/c/s` (g = go to, then first letter of section)
  - Tooltip on hover (uses Radix Tooltip)
  - Bottom: profile avatar / cluster indicator
- [x] Create `apps/studio/src/layout/TopBar.tsx`:
  - Left: Studio logo mark + `ClusterPicker`
  - Center: search trigger button (opens command palette, ⌘K)
  - Right: `ModeToggle` | `ThemePicker` | AI toggle button
- [x] Create `apps/studio/src/layout/AIDrawer.tsx`:
  - Collapsible panel from right edge
  - Placeholder content: "AI chat coming in Phase 8"
  - Animated slide-in (CSS transition, no JS animation library)
- [x] Wire Shell into `app.tsx` as root layout wrapper

### 1.5 Routing

- [x] Install/configure wouter in `app.tsx`
- [x] Define routes matching all pages:
  ```
  /                     → Dashboard
  /models               → Models
  /models/:id           → ModelDetail
  /definitions          → Definitions
  /definitions/:key     → DefinitionDetail
  /instances            → Instances
  /instances/:key       → InstanceDetail
  /incidents            → Incidents
  /incidents/:key       → IncidentDetail
  /tasks                → Tasks
  /tasks/:key           → TaskDetail
  /decisions            → Decisions
  /decisions/:key       → DecisionDetail
  /settings             → Settings
  ```
- [x] Each page is a stub component with a page title `<h1>` and a placeholder paragraph
- [x] Sidebar icons navigate to the correct route
- [x] 404 fallback route
- [x] Verify: all routes render, back/forward browser buttons work, direct URL access works

### 1.6 Developer / Operator mode

- [x] Create `apps/studio/src/stores/mode.ts` (Zustand):
  - State: `mode: 'developer' | 'operator'`, default `'developer'`
  - Persisted to localStorage
- [x] Create `ModeToggle` component: pill toggle "Dev | Ops" in TopBar
- [x] Sidebar reorders items based on mode:
  - Developer: Models, Definitions, Instances, Incidents, Tasks, Decisions
  - Operator: Instances, Incidents, Tasks, Definitions, Decisions, Models
- [x] Verify: toggle persists across reload; sidebar reorders correctly

### 1.7 Cluster connection & profile management

- [x] Create `apps/studio/src/stores/cluster.ts` (Zustand):
  - State: `profiles: Profile[]`, `activeProfile: string | null`, `proxyUrl: string` (default `http://localhost:3033`)
  - Action: `loadProfiles()` — `GET {proxyUrl}/profiles`, populates `profiles`
  - Action: `setActiveProfile(name)` — persists to localStorage, invalidates all TanStack Query cache
  - On init: load profiles, restore persisted active profile
- [x] Create `ClusterPicker` component:
  - Dropdown showing all profile names from `cluster.ts`
  - Active profile with `●` indicator
  - "No cluster connected" state when proxy unreachable
  - "Add profile" link → navigates to `/settings`
- [x] Create `apps/studio/src/api/client.ts`:
  - Exports `getProxyUrl(): string` from cluster store
  - Exports `proxyFetch(path, options)` — wraps fetch, adds `x-profile` header from active profile
  - Used by all TanStack Query hooks
- [x] Create `apps/studio/src/api/keys.ts` — typed query key factory:
  ```typescript
  export const keys = {
    definitions: () => ['definitions'] as const,
    definition: (key: string) => ['definitions', key] as const,
    definitionXml: (key: string) => ['definitions', key, 'xml'] as const,
    instances: (filter?: object) => ['instances', filter] as const,
    // ... etc
  }
  ```
- [x] Create `apps/studio/src/api/queries.ts` — stub file, populated per phase
- [x] Create `apps/studio/src/api/queryClient.ts`:
  - Configures `QueryClient` with default `staleTime: 30_000`, `gcTime: 5 * 60_000`
  - Export singleton `queryClient`
- [x] Wire `QueryClientProvider` in `app.tsx`
- [x] Verify: proxy must be running; profiles load and display in `ClusterPicker`; switching profile persists

### 1.8 Storage abstraction (IndexedDB)

- [x] Create `apps/studio/src/storage/types.ts` — `StorageAdapter` interface + `ModelFile` type (see plan)
- [x] Create `apps/studio/src/storage/indexeddb.ts` — `IndexedDbAdapter`:
  - DB name: `bpmnkit-studio`, version 1
  - Object stores: `models` (keyPath: `id`), `preferences` (keyPath: `key`)
  - Implements all `StorageAdapter` methods
  - `saveModel` generates uuid if `id` absent, sets `updatedAt`
- [x] Create `apps/studio/src/storage/index.ts` — detects runtime, exports correct adapter:
  ```typescript
  export const storage: StorageAdapter =
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
      ? new TauriAdapter()   // loaded dynamically
      : new IndexedDbAdapter()
  ```
- [x] Create `apps/studio/src/stores/models.ts` (Zustand):
  - State: `models: ModelFile[]`, `loaded: boolean`
  - Action: `loadModels()` — calls `storage.listModels()`
  - Action: `saveModel(m)` — calls `storage.saveModel()`, updates local state
  - Action: `deleteModel(id)` — calls `storage.deleteModel()`, removes from local state
  - Load on app init
- [x] Verify: save a model via store, reload page, model persists in IndexedDB

### 1.9 Settings page (stub)

- [x] `Settings.tsx`: shows proxy URL (editable), list of profiles (read-only for now), active theme picker
- [x] Proxy URL editable input → saves to `cluster` store + localStorage

### 1.10 Foundation quality gate

- [x] `pnpm --filter @bpmnkit/studio typecheck` passes with zero errors
- [x] `pnpm biome check apps/studio` passes with zero warnings
- [x] `pnpm --filter @bpmnkit/studio build` produces a valid `dist/`
- [x] Lighthouse score: Performance ≥ 90, Accessibility ≥ 95 on the shell (no real data loaded)
- [x] All three themes render correctly (manual check in browser)

---

## Phase 2 — Dashboard

**Goal**: Useful at-a-glance view of a connected cluster. First real data in the app.

### 2.1 TanStack Query wiring

- [x] Add `useDashboardStats()` to `queries.ts`:
  - Fetches from proxy: active instance count, incident count, active job count, deployed definition count, user task count
  - `staleTime: 15_000`, refetch on window focus
  - Uses `proxyFetch` with active profile header
- [x] Add `useRecentDefinitions()`: last 5 deployed definitions by deploy date, `staleTime: 30_000`
- [x] Add `useActiveIncidents()`: top 5 incidents ordered by creation, `staleTime: 10_000`
- [x] Add `useRecentInstances()`: last 5 started instances, `staleTime: 10_000`

### 2.2 Stat cards

- [x] Create `StatCard` component: icon + number + label + trend indicator (up/down/stable)
- [x] Dashboard layout (grid 2×3 or 3×2 depending on mode):
  - Running instances (with link to `/instances`)
  - Active incidents (link to `/incidents`, red if > 0)
  - Pending user tasks (link to `/tasks`)
  - Deployed definitions (link to `/definitions`)
  - Active jobs
  - Developer mode: local models count (link to `/models`)
  - Operator mode: overdue tasks count
- [x] Loading skeleton state for all cards (CSS skeleton animation, no library)
- [x] Error state: "Could not reach cluster" with retry button

### 2.3 Recent activity lists

- [x] `RecentDefinitionsList`: last 5 deployed definitions — name, version, deploy date, instance count
- [x] `ActiveIncidentsList`: top incidents — process name, element, error truncated to 80 chars, age
- [x] `RecentInstancesList`: last started instances — definition name, state pill, started age

### 2.4 Developer mode extras

- [x] Quick action button: "New Model" (opens modal from Phase 3 create flow)
- [x] "Open in editor" link on each recent definition row (routes to `/models` filtered by processDefinitionId)

### 2.5 Operator mode extras

- [x] Task queue depth card: tasks by candidateGroup (simple bar chart using CSS only, no chart library)
- [x] SLA indicators: placeholder for now (Phase 7)

### 2.6 Auto-refresh

- [x] `refetchInterval` on all dashboard queries: 15s while window is focused, paused when hidden
- [x] Visual "last updated" indicator in page header: "Updated 12s ago" using relative time formatter (native `Intl.RelativeTimeFormat`)
- [x] Manual refresh button

### 2.7 Dashboard quality gate

- [x] All stat cards show live data from a connected cluster
- [x] Switching profiles updates all data without page reload
- [x] Empty state for all lists (no instances, no incidents, etc.)
- [x] Zero TS errors, zero Biome warnings
- [x] No unnecessary re-renders (verify with Preact DevTools)

---

## Phase 3 — Models Section

**Goal**: Manage local BPMN/DMN/Form files stored in IndexedDB.

### 3.1 Models list page

- [x] `Models.tsx`: list/grid toggle (persisted per user in preference store)
- [x] Grid view: `ProcessCard` — thumbnail (`DiagramPreview`), name, type badge, last modified
- [x] List view: table — name, type, last modified, processDefinitionId (if linked), actions
- [x] Search: client-side filter on name (from Zustand `models` store, no server call)
- [x] Filter by type: "All | BPMN | DMN | Form" tab pills
- [x] Empty state: illustration + "Create your first model" CTA

### 3.2 DiagramPreview component

- [x] `DiagramPreview.tsx`: renders `@bpmnkit/canvas` in a hidden offscreen div, captures SVG, displays as `<img>`
- [x] Lazy: only renders visible cards (Intersection Observer)
- [x] Memoized: re-renders only when `content` prop changes
- [x] Fallback: file type icon if XML parse fails

### 3.3 Create new model

- [x] "New Model" button → modal with:
  - Type selector: BPMN / DMN / Form (icon cards)
  - Name input (auto-suggested: "My Process 1", "My Decision 1", etc.)
  - "Create" button
- [x] Creates empty XML:
  - BPMN: `Bpmn.makeEmpty(name)` from `@bpmnkit/core`
  - DMN: `Dmn.makeEmpty(name)` from `@bpmnkit/core`
  - Form: `Form.makeEmpty(name)` from `@bpmnkit/core`
- [x] Saves to `ModelStore`, navigates to `/models/:id`

### 3.4 Import model

- [x] "Import" button → file picker (`.bpmn`, `.dmn`, `.form`, `.json`)
- [x] Drag & drop on the Models page background
- [x] Validates file type by attempting parse with `@bpmnkit/core`
- [x] Shows error toast if invalid
- [x] Saves, navigates to the new model

### 3.5 Model actions

- [x] Delete: confirmation dialog → removes from IndexedDB + store
- [x] Rename: inline edit on the name
- [x] Duplicate: creates a copy with "Copy of …" prefix
- [x] Link to definition: input to set `processDefinitionId` (free text for now; Phase 4 adds a picker)

### 3.6 Models quality gate

- [x] Create / import / delete round-trip works
- [x] IndexedDB persistence: model survives hard reload
- [x] `DiagramPreview` renders correctly for all three model types
- [x] Zero TS errors, zero Biome warnings

---

## Phase 4 — Definitions Section

**Goal**: Browse deployed definitions; canvas view; immutable XML cached forever.

### 4.1 Definitions list page

- [x] Add `useDefinitions(filter?)` to `queries.ts`: `staleTime: 30_000`, paginated
- [x] `Definitions.tsx`: searchable, filterable table — name, process ID, version, tenant, deploy date, instance count, incident count
- [x] Search: debounced 300ms, passes to API filter
- [x] Filter by tenant (multi-select), by state
- [x] Group by processDefinitionId (show latest version with "N versions" expandable row)
- [x] Click row → navigate to `/definitions/:key`
- [x] "Open in local editor" action per row (if a matching local model exists, highlight the link)

### 4.2 Definition detail page

- [x] Add `useDefinition(key)`: `staleTime: 60_000`
- [x] Add `useDefinitionXml(key)`: **`staleTime: Infinity`** — immutable once deployed
- [x] `DefinitionDetail.tsx` layout:
  - Left: canvas (`@bpmnkit/canvas` with `@bpmnkit/plugins/token-highlight`)
  - Right sidebar (240px): metadata, instances panel, incidents panel, version list
- [x] Canvas renders the deployed XML from `useDefinitionXml`
- [x] Token highlight shows active element positions across running instances
- [x] Sidebar — Instances panel: count + last 5 instances (link to each)
- [x] Sidebar — Incidents panel: count + list (link to each)
- [x] Sidebar — Versions panel: all versions of same processDefinitionId, active marked

### 4.3 XML cache verification

- [x] On second visit to same definition, no network request made for XML (verify in DevTools)
- [x] After deploy (Phase 5), cache for that processDefinitionId key is invalidated

### 4.4 Definitions quality gate

- [x] XML for a deployed definition loads once, then serves from cache on all subsequent views
- [x] Canvas renders the deployed diagram correctly in all three themes
- [x] Token highlight updates as instances advance (polling interval)
- [x] Zero TS errors, zero Biome warnings

---

## Phase 5 — Editor Integration

**Goal**: Edit local models inside Studio; see deployed state alongside; deploy from within.

### 5.1 ModelDetail page layout

- [x] `ModelDetail.tsx` layout:
  - Full-height `@bpmnkit/editor` (main area)
  - Collapsible right panel (240px): "Deployed Versions"
  - Top breadcrumb: Models > [Model Name]
- [x] Editor instantiated with:
  - `@bpmnkit/plugins/command-palette-editor`
  - `@bpmnkit/plugins/config-panel`
  - `@bpmnkit/plugins/optimize`
  - `@bpmnkit/plugins/history`
  - `@bpmnkit/plugins/zoom-controls`
  - Storage save on `diagram:change` (debounced 2s → `storage.saveModel()`)

### 5.2 DMN and Form editor routing

- [x] If `model.type === 'dmn'` → instantiate editor with `@bpmnkit/plugins/dmn-editor` instead
- [x] If `model.type === 'form'` → instantiate with `@bpmnkit/plugins/form-editor` instead
- [x] Each editor type cleans up on unmount (`editor.destroy()`)

### 5.3 Deployed versions panel

- [x] `DeployedVersionsPanel`: queries `useDefinitions()` filtered by `processDefinitionId === model.processDefinitionId`
- [x] Lists all versions: version number, deploy date, running instances count, incidents count
- [x] Each row links to `/definitions/:key`
- [x] "No deployed versions" state with "Deploy now" CTA if `processDefinitionId` is set but nothing found
- [x] "Link to process ID" prompt if `model.processDefinitionId` is not set (input + save)

### 5.4 Deploy action

- [x] "Deploy" button in editor toolbar:
  - Sends `POST /process-definitions/deploy` via proxy with model XML
  - On success: invalidates `keys.definitions()` cache, updates deployed versions panel
  - Shows success toast with deployed key + version number
  - On error: shows error toast with status + message
- [x] After deploy, if `model.processDefinitionId` was unset, extracts it from response and saves to model

### 5.5 Auto-save

- [x] Debounced 2s save on every `diagram:change` event
- [x] "Saved" / "Saving…" indicator in breadcrumb area (small dot or text)
- [x] Manual ⌘S also triggers immediate save

### 5.6 Editor quality gate

- [x] Edit → auto-save → reload page → changes persisted in IndexedDB
- [x] Deploy → definitions list updates → deployed versions panel updates
- [x] DMN and Form editors load for their respective file types
- [x] Editor `destroy()` called on route change (no memory leaks)
- [x] Zero TS errors, zero Biome warnings

---

## Phase 6 — Instances & Incidents

**Goal**: Full operational monitoring views with canvas overlays.

### 6.1 Instances list page

- [x] Add `useInstances(filter?)` to `queries.ts`: `staleTime: 10_000`, paginated
- [x] `Instances.tsx`: filterable table — state badge, definition name, process ID, start time, end time, key
- [x] Filters: state (ACTIVE, COMPLETED, CANCELED, TERMINATED), definition name search, date range, has incidents toggle
- [x] Click row → `/instances/:key`
- [x] Bulk cancel action (checkbox select + "Cancel selected" button, with confirmation)

### 6.2 Instance detail page

- [x] Add `useInstance(key)`: `staleTime: 15_000`
- [x] Add `useInstanceVariables(key)`: `staleTime: 15_000`
- [x] Add `useInstanceAuditLog(key)`: `staleTime: 30_000`
- [x] `InstanceDetail.tsx` layout:
  - Left: canvas with `@bpmnkit/canvas` + `@bpmnkit/plugins/token-highlight` highlighting current elements
  - Right panel (280px): tabbed — Variables | Audit Log | Incidents
- [x] Variables tab: key-value list, nested objects expandable (no library — recursive component)
- [x] Audit log tab: timeline list — element name, type icon, timestamps, duration
- [x] Incidents tab: list of active incidents for this instance with retry/resolve actions
- [x] Cancel instance button (top right, confirmation dialog)
- [x] "View definition" link → `/definitions/:definitionKey`

### 6.3 Incidents list page

- [x] Add `useIncidents(filter?)` to `queries.ts`: `staleTime: 10_000`
- [x] `Incidents.tsx`: filterable table — type, error message (truncated), element, definition, instance, creation time
- [x] Filters: incident type (multi-select), definition name, has retries left toggle
- [x] Click row → `/incidents/:key`

### 6.4 Incident detail page

- [x] Add `useIncident(key)`: `staleTime: 15_000`
- [x] `IncidentDetail.tsx` layout:
  - Canvas with failing element highlighted in red (custom CSS class injected via token-highlight plugin)
  - Error message panel: type, message, stack trace if available
  - Retry button (if retries > 0): increments retries via API
  - Resolve button: marks resolved
  - Link to parent instance
  - Link to definition

### 6.5 Instances & Incidents quality gate

- [x] Live instance: variables show correctly, audit log reflects element progression
- [x] Cancel instance → instance state changes to TERMINATED
- [x] Incident: failing element highlighted on canvas
- [x] Retry incident → job retries increment
- [x] Zero TS errors, zero Biome warnings

---

## Phase 7 — User Tasks

**Goal**: Full task management with Camunda Form rendering.

### 7.1 `packages/user-tasks` — new package

- [x] Create `packages/user-tasks/` with `package.json` (`@bpmnkit/user-tasks`)
- [x] Add to `pnpm-workspace.yaml`, `turbo.json` pipeline
- [x] Implement `createUserTaskWidget(options)`:
  - Renders task metadata: name, assignee, candidate groups, due date, priority
  - Fetches form schema via `GET /user-tasks/:key/form` (via passed `client`)
  - Instantiates `@bpmnkit/plugins/form-viewer` to render the form
  - Exposes action buttons: Claim / Unclaim / Complete / Reject
  - Theme applied via `applyTheme()` from `@bpmnkit/ui`
- [x] Export type `UserTaskWidgetOptions` and `UserTaskWidgetApi`
- [x] Add `typecheck`, `build` scripts; zero TS errors

### 7.2 Tasks list page

- [x] Add `useUserTasks(filter?)` to `queries.ts`: `staleTime: 30_000`
- [x] `Tasks.tsx`: filterable table — name, assignee (or "Unassigned"), candidate groups, due date (with overdue red highlight), priority, definition
- [x] Filters: assignee (my tasks / unassigned / all), candidate group (multi-select), state, due date range
- [x] "My tasks" default filter in Operator mode
- [x] Click row → `/tasks/:key`

### 7.3 Task detail page

- [x] Add `useUserTask(key)`: `staleTime: 20_000`
- [x] `TaskDetail.tsx` layout:
  - Header: task name, assignee, due date, priority badge
  - Main: `createUserTaskWidget` embedded (form rendering + actions)
  - Sidebar: process context (definition name, instance key links), task variables
- [x] Claim: calls `POST /user-tasks/:key/assignment`, updates local cache
- [x] Complete: calls `POST /user-tasks/:key/completion` with form variables, invalidates task list cache
- [x] Unclaim: calls `DELETE /user-tasks/:key/assignment`
- [x] Success: navigate back to `/tasks` with success toast

### 7.4 User tasks quality gate

- [x] Claim task → assignee updates in list view without full reload
- [x] Complete task with form variables → task disappears from list
- [x] Camunda Form renders correctly (all field types from form-viewer)
- [x] Zero TS errors, zero Biome warnings in both `apps/studio` and `packages/user-tasks`

---

## Phase 8 — AI Chat

**Goal**: Context-aware AI always available across all views. Reuses existing proxy AI bridge.

### 8.1 AIDrawer wiring

- [x] `AIDrawer.tsx`: full implementation
  - Message list: user messages (right-aligned), AI messages (left-aligned with markdown rendering)
  - Input textarea: submit on Enter (Shift+Enter for newline), send button
  - Clear conversation button
  - Context indicator: "Talking about: [current entity]" subtitle
- [x] Minimal markdown rendering for AI responses: code blocks, bold, links (no heavy library — use regex transform + `dangerouslySetInnerHTML` with sanitization)
- [x] Conversation history in Zustand store (in-memory only, cleared on refresh)

### 8.2 Proxy streaming connection

- [x] `useAIStream()` hook (or Zustand action):
  - `POST {proxyUrl}/stream` with SSE
  - Body: `{ messages, systemPrompt, context }`
  - Streams tokens into message buffer
  - Appends completed message to conversation history

### 8.3 Context injection

- [x] `buildAIContext()` function — reads current route + relevant store state:
  - On `/definitions/:key` → includes definition XML (from TanStack Query cache — already fetched)
  - On `/instances/:key` → includes instance state, variables, audit log, active incidents
  - On `/incidents/:key` → includes incident details + definition XML of the failing element
  - On `/models/:id` → includes the current model XML
  - On `/tasks/:key` → includes task details + form schema
  - Default → cluster summary stats
- [x] Context passed as `systemPrompt` to the proxy stream endpoint
- [x] Context indicator in AIDrawer header shows what entity is in context

### 8.4 Command palette integration

- [x] Cmd+K command palette (using `@bpmnkit/plugins/command-palette` as reference implementation or native Radix `Dialog`):
  - "Ask AI: …" item — opens AI drawer and pre-fills the typed query
  - "Go to Dashboard / Models / Instances / …" — navigation shortcuts
  - "New Model" — opens create modal
  - "Switch to [profile]" — cluster switching
  - "Switch theme" — cycles themes
- [x] All sidebar keyboard shortcuts also registered here for discoverability

### 8.5 AI quality gate

- [x] Ask "What's wrong with this incident?" on IncidentDetail → AI receives correct XML + error context
- [x] Ask "How many instances are running?" on Dashboard → AI receives current counts
- [x] AI response streams token by token (not delivered all at once)
- [x] Context updates when navigating between pages without reopening drawer
- [x] Zero TS errors, zero Biome warnings

---

## Phase 9 — Desktop Wrapper

**Goal**: Native Tauri app wrapping Studio with filesystem storage. Zero code duplication.

### 9.1 `apps/studio-desktop` scaffold

- [ ] Create `apps/studio-desktop/` with `package.json`
- [ ] `src-tauri/tauri.conf.json`:
  - Dev: points to `http://localhost:5174` (Studio's Vite dev server)
  - Prod: bundles Studio's `dist/` as frontend assets
  - Window: 1440×900, min 800×600, decorated, title "BPMNkit Studio"
  - Bundle: includes `proxy-rs` binaries (same approach as existing `apps/desktop`)
- [ ] Add `@tauri-apps/plugin-fs` for filesystem access
- [ ] Cargo.toml: minimal Tauri dependencies + fs plugin

### 9.2 TauriAdapter

- [ ] Create `apps/studio-desktop/src/storage/tauri.ts` — `TauriAdapter` implementing `StorageAdapter`:
  - Storage directory: `~/.bpmnkit/studio/models/`
  - `listModels()`: lists `.bpmn`, `.dmn`, `.form` files in storage dir, reads metadata sidecar `.json`
  - `saveModel()`: writes `{id}.{type}` + `{id}.meta.json`
  - `deleteModel()`: deletes both files
  - `getPreference(key)`: reads `~/.bpmnkit/studio/prefs.json` (parsed JSON)
  - `setPreference(key, value)`: updates and writes `prefs.json`
- [ ] Inject adapter before Studio mounts: Tauri app sets `window.__studio_adapter__` to `'tauri'`; Studio's `storage/index.ts` checks this flag

### 9.3 Native file operations

- [ ] Register file associations in `tauri.conf.json`: `.bpmn`, `.dmn`, `.form`
- [ ] Handle `tauri://file-drop` events on the window → import dropped files into Studio
- [ ] macOS/Linux open-with: system sends file path via IPC → Studio imports and opens model
- [ ] Native application menu: File > New BPMN / New DMN / New Form / Import / ──── / Quit

### 9.4 Proxy-rs integration

- [ ] Bundle same `proxy-rs` binaries as `apps/desktop` (no duplication — reference same build output)
- [ ] Tauri sidecar config: auto-start proxy-rs on app launch
- [ ] Proxy URL auto-detected from sidecar port (no manual config needed in desktop mode)
- [ ] On app quit: stop proxy-rs sidecar

### 9.5 Desktop quality gate

- [ ] `apps/studio-desktop` builds and launches as a native app
- [ ] Open `.bpmn` file from Finder/Explorer → Studio opens the model in editor
- [ ] Create/save model → file appears in `~/.bpmnkit/studio/models/`
- [ ] AI chat works (proxy-rs starts automatically)
- [ ] App quit is clean (no orphan processes)
- [ ] Zero TS errors, zero Biome warnings

---

## Cross-cutting Concerns (apply throughout all phases)

### Accessibility

- [ ] All interactive elements reachable by keyboard (Tab / Shift+Tab)
- [ ] All icon-only buttons have `aria-label`
- [ ] Color is never the sole differentiator (state badges have both color + text)
- [ ] Focus ring visible in all themes (Tailwind `focus-visible:ring-2`)
- [ ] Screen reader: `aria-live` regions for toast notifications and streaming AI text
- [ ] Lighthouse Accessibility score ≥ 95 maintained throughout

### Performance

- [ ] No layout thrashing: reads before writes in any DOM manipulation code
- [ ] All lists with > 20 items use windowed rendering (Intersection Observer lazy load, or `@tanstack/virtual` if needed)
- [ ] Editor and Canvas components are lazy-loaded (dynamic `import()`) — not in the initial bundle
- [ ] Initial bundle (without editor/canvas) < 150 KB gzipped
- [ ] TanStack Query `placeholderData: keepPreviousData` on paginated queries (no flash of empty on page change)

### Error handling

- [ ] Every TanStack Query error renders an error state with message + retry button (no silent failures)
- [ ] Every mutating action (deploy, complete task, cancel instance) has a toast: success or detailed error
- [ ] Proxy unreachable → banner at top of app: "Proxy offline — start with `pnpm proxy`" with instructions
- [ ] Unknown routes → 404 page with navigation back to dashboard

### Testing

- [ ] `apps/studio` Vitest config: unit tests for all stores (Zustand state + actions)
- [ ] Unit tests for `StorageAdapter` implementations (mock IndexedDB via `fake-indexeddb`)
- [ ] Unit tests for `buildAIContext()` function
- [ ] Unit tests for `@bpmnkit/user-tasks`: widget instantiation, action handlers
- [ ] No integration tests against real Camunda (too slow for CI) — use TanStack Query mock adapters

### Documentation

- [ ] `doc/progress.md` updated after each phase completes
- [ ] `doc/features.md` updated with Studio features as they ship
- [ ] `doc/documentation.md` updated with Studio usage guide
- [ ] `doc/roadmap.md` (this file) items checked off as completed
