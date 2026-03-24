# BPMNkit Studio — Architecture Plan

> Created: 2026-03-24
> Status: Approved, implementation starting Phase 1

---

## Vision

A single unified web application that replaces the fragmented Camunda tooling landscape
(Modeler, Operate, Tasklist). The central entity is the **process model** — every view,
action, and piece of data is anchored to it. Studio covers the full lifecycle: design,
deploy, monitor, operate.

---

## Name

**BPMNkit Studio** — product name "Studio", consistent with the existing brand.
- URL: `studio.bpmnkit.com` (hosted) / `localhost:5174` (local)
- App package: `apps/studio`
- Desktop wrapper: `apps/studio-desktop`

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| UI runtime | **Preact** + `preact/compat` | 3 KB vs 45 KB React; compat alias means shadcn/ui works unchanged |
| Global state | **Zustand** | Already used in `@bpmnkit/operate`; no scattered hooks |
| Server state + caching | **TanStack Query** | Smart caching with `staleTime: Infinity` for immutable resources |
| Routing | **wouter** | 1.5 KB, hash/history mode, works with preact/compat |
| UI components | **shadcn/ui** (copy-in) | Not a runtime dependency — components copied as source; built on Radix UI + Tailwind |
| CSS | **Tailwind v4** | CSS-first config; maps naturally to `--bpmnkit-*` tokens |
| Icons | **lucide-preact** | Tree-shakable, single dep |
| Build | **Vite** | Already used everywhere in the monorepo |
| API calls | **Via proxy (port 3033)** | Proxy owns auth + profiles; no OAuth secrets in browser; no CORS problems |

**No React.** `preact/compat` is aliased in Vite so all React-assuming libs (shadcn,
Radix, TanStack Query) work without modification.

**No hooks for state.** Components read from Zustand stores via selectors. `useStore`
calls appear only at component roots, never nested. All mutations go through store
actions.

---

## Connection Model

```
Studio → Proxy (localhost:3033) → Camunda cluster
```

Studio hits the existing proxy for all Camunda API calls — same model as
`@bpmnkit/operate`. The proxy manages:

- Profile storage (`GET /profiles`)
- Auth token lifecycle (OAuth2, Bearer, Basic)
- AI streaming (`POST /stream`)
- Cluster selection via `x-profile` request header

The proxy must be running for Studio to work against a real cluster. For
offline/demo mode, Studio falls back to mock data.

This applies to both the local and hosted versions of Studio.

---

## Storage Abstraction

The `StorageAdapter` interface lives in `apps/studio/src/storage/types.ts`.
Two implementations, auto-selected at runtime:

| Runtime | Adapter | Detection |
|---|---|---|
| Web browser | `IndexedDbAdapter` | default |
| Tauri desktop | `TauriAdapter` | `window.__TAURI_INTERNALS__` present |

```typescript
interface StorageAdapter {
  listModels(): Promise<ModelFile[]>
  getModel(id: string): Promise<ModelFile | null>
  saveModel(model: Omit<ModelFile, 'updatedAt'>): Promise<ModelFile>
  deleteModel(id: string): Promise<void>
  getPreference<T>(key: string, fallback: T): Promise<T>
  setPreference<T>(key: string, value: T): Promise<void>
}

interface ModelFile {
  id: string                     // uuid
  name: string
  type: 'bpmn' | 'dmn' | 'form'
  content: string                // XML / JSON
  processDefinitionId?: string   // links to deployed definitions
  createdAt: number
  updatedAt: number
  tags?: string[]
}
```

The `TauriAdapter` lives in `apps/studio-desktop/src/storage/tauri.ts` and uses
`@tauri-apps/plugin-fs`. Studio detects the runtime itself — the desktop app injects
nothing extra.

---

## App Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ◈ Studio  [MyCluster ▾]  [search ⌘K]        [Dev|Ops] [☀] [?] │  ← TopBar (48px)
├──┬───────────────────────────────────────────────────┬───────────┤
│  │                                                   │           │
│  │                  Main Panel                       │  AI Chat  │
│  │                                                   │  (280px)  │
│ S│                                                   │           │
│ I│                                                   │ collapsible
│ D│                                                   │           │
│ E│                                                   │           │
│  │                                                   │           │
│(64px)                                                             │
└──┴───────────────────────────────────────────────────┴───────────┘
```

**Sidebar** (64px, always visible): icon buttons for Dashboard, Models, Definitions,
Instances, Incidents, Tasks, Decisions, Settings. Active section highlighted.
Keyboard shortcuts: `g d` (dashboard), `g m` (models), `g i` (instances), etc.
(Linear-style navigation).

**TopBar**: cluster picker (active profile dropdown), global search (⌘K),
Dev/Ops mode toggle (pill button), theme button.

**AI Chat drawer**: collapsible right panel (280px). Context-aware — when viewing a
definition the AI receives the XML; when viewing an instance it receives state +
variables.

**Main panel**: fills remaining space. One scroll container per page maximum.

---

## Caching Strategy (TanStack Query)

| Query | staleTime | gcTime | Notes |
|---|---|---|---|
| Definitions list | 30s | 5min | |
| Definition detail | 60s | 10min | |
| **Definition XML** | **Infinity** | 30min | **Immutable — deployed XML never changes** |
| Instances list | 10s | 2min | Needs freshness |
| Instance detail | 15s | 5min | |
| Incidents list | 10s | 2min | |
| User tasks list | 30s | 5min | |
| User task detail | 20s | 5min | |
| Decisions list | 60s | 10min | |
| Active jobs | 10s | 2min | |
| Dashboard aggregate | 15s | 2min | SSE preferred, poll fallback |

Cache is busted on deploy: `queryClient.invalidateQueries({ queryKey: ['definitions'] })`.

---

## New Package: `packages/user-tasks`

Vanilla TS (no framework), like `@bpmnkit/operate`. Public API:

```typescript
createUserTaskWidget(options: {
  container: HTMLElement
  task: UserTask           // from @bpmnkit/api
  client: CamundaClient
  theme?: Theme
  onComplete(variables: Record<string, unknown>): void
  onClaim(): void
  onUnclaim(): void
  onReject?(reason: string): void
}): {
  destroy(): void
  setTask(task: UserTask): void
}
```

Internally uses `@bpmnkit/plugins/form-viewer` to render the Camunda Form attached
to the task. No React/Preact dependency in the package itself.

---

## File Structure

```
apps/studio/
  src/
    main.tsx               ← Preact mount, adapter detection, QueryClient setup
    app.tsx                ← Root: Router, ThemeProvider, QueryClientProvider

    layout/
      Shell.tsx            ← Sidebar + main + AI drawer
      TopBar.tsx
      Sidebar.tsx
      AIDrawer.tsx

    pages/
      Dashboard.tsx
      Models.tsx           ← Model browser (local files)
      ModelDetail.tsx      ← Editor embedded + deployed definitions panel
      Definitions.tsx      ← Deployed definitions on cluster
      DefinitionDetail.tsx ← Canvas + running instances + incidents
      Instances.tsx
      InstanceDetail.tsx   ← Canvas with token overlay + variables + audit
      Incidents.tsx
      IncidentDetail.tsx
      Tasks.tsx
      TaskDetail.tsx       ← User task widget embedded
      Decisions.tsx
      DecisionDetail.tsx
      Settings.tsx         ← Profiles, theme, proxy URL

    stores/
      cluster.ts           ← Active profile, CamundaClient instance
      mode.ts              ← 'developer' | 'operator', persisted
      theme.ts             ← Theme, persisted
      models.ts            ← Syncs local model list from StorageAdapter

    api/
      client.ts            ← CamundaClient factory (profile-aware, via proxy)
      queries.ts           ← All TanStack Query hooks
      keys.ts              ← Query key factories (type-safe)

    storage/
      types.ts             ← StorageAdapter interface, ModelFile type
      indexeddb.ts         ← IndexedDB implementation

    components/
      ui/                  ← shadcn/ui copied components
      DiagramPreview.tsx   ← Miniaturized @bpmnkit/canvas thumbnail
      ProcessCard.tsx
      InstanceRow.tsx
      IncidentBadge.tsx
      StatusPill.tsx
      ClusterPicker.tsx
      ModeToggle.tsx

  index.html
  vite.config.ts           ← preact/compat alias, Tailwind plugin
  tailwind.config.ts       ← Maps var(--bpmnkit-*) to Tailwind tokens
  tsconfig.json

apps/studio-desktop/
  src/
    main.ts                ← Tauri entry (webview loads studio assets)
    storage/
      tauri.ts             ← TauriAdapter using @tauri-apps/plugin-fs
  src-tauri/
    tauri.conf.json        ← Points to studio's dist/ or Vite dev server
    Cargo.toml
  package.json

packages/user-tasks/
  src/
    index.ts               ← createUserTaskWidget
    form.ts                ← Form resolution + rendering
    actions.ts             ← Claim/complete/unclaim/reject
  package.json
```

---

## Developer vs Operator Mode

Two personas, one app. Toggle is always visible in the TopBar; persisted in
localStorage via the `mode` store.

| | Developer mode | Operator mode |
|---|---|---|
| Default landing | Models browser | Dashboard |
| Dashboard emphasis | Models count, quick "New Model" | Task queue depth, SLA indicators |
| Primary nav items | Models, Definitions first | Instances, Incidents, Tasks first |
| Quick actions | Deploy, New model | Claim task, Retry incident |

Both modes share the same navigation — mode only changes defaults and emphasis,
not available features.

---

## What Does NOT Change

- All existing packages are consumed as-is: `@bpmnkit/editor`, `@bpmnkit/canvas`,
  `@bpmnkit/api`, `@bpmnkit/operate`, `@bpmnkit/plugins`, `@bpmnkit/profiles`,
  `@bpmnkit/ui`
- `apps/desktop` is not modified — it continues to exist as the current desktop app
- `apps/proxy` is not modified — Studio depends on it
- `@bpmnkit/operate` is not deprecated — it remains a standalone embeddable widget
- All published npm packages remain published and working

---

## Implementation Phases (summary)

| Phase | Title | Deliverable |
|---|---|---|
| 1 | Shell & Foundation | Running app, layout, themes, routing, cluster connection |
| 2 | Dashboard | Live stats cards, counts, recent activity |
| 3 | Models Section | Local model browser, create/import/delete, IndexedDB |
| 4 | Definitions Section | Deployed definitions, canvas view, immutable XML cache |
| 5 | Editor Integration | Embed editor, deployed versions panel, deploy action |
| 6 | Instances & Incidents | Monitoring views, token overlay, variables, audit |
| 7 | User Tasks | Task browser, form rendering, claim/complete |
| 8 | AI Chat | Context-aware AI drawer wired to proxy |
| 9 | Desktop Wrapper | Tauri app, TauriAdapter, native file associations |

See `doc/studio-roadmap.md` for the detailed action item breakdown per phase.
