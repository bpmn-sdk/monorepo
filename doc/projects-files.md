# Projects & File System Persistence

## Overview

Studio supports two storage modes:

| Mode | Storage | When |
|---|---|---|
| **Local (default)** | Browser IndexedDB | No project selected |
| **File System** | Files on disk via proxy | Project selected + proxy running |

Models in local mode are flat and browser-only. In file system mode, models live in a real directory (typically a git repository) with full folder hierarchy, and all metadata is persisted as sidecar files alongside the content files.

---

## File System Layout

```
my-project/                      # any folder (git repo or plain dir)
├── .bpmnkit/
│   └── project.json             # { name, description } — optional
├── processes/
│   ├── order-process.bpmn
│   ├── order-process.md         # standalone markdown note (optional)
│   └── .bpmnkit/
│       └── order-process.bpmn.meta.json   # sidecar metadata
├── decisions/
│   ├── shipping-cost.dmn
│   └── .bpmnkit/
│       └── shipping-cost.dmn.meta.json
└── forms/
    ├── order-form.form
    └── .bpmnkit/
        └── order-form.form.meta.json
```

### Supported file types

| Extension | Type | Editor |
|---|---|---|
| `.bpmn` | BPMN process | BPMN diagram editor |
| `.dmn` | DMN decision | DMN editor |
| `.form` | Camunda Form | JSON form editor |
| `.md` | Markdown | Plain text editor |

### Sidecar metadata (`<dir>/.bpmnkit/<filename>.meta.json`)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "processDefinitionId": "order-process",
  "runVariables": "{\"amount\": 100}",
  "tags": ["finance", "ecommerce"],
  "createdAt": 1712000000000,
  "scenarios": [
    {
      "id": "scen-1",
      "name": "Happy path",
      "inputs": { "amount": 50 },
      "expect": { "path": ["approve", "end"] }
    }
  ],
  "inputVars": [
    { "name": "amount", "value": "100" }
  ]
}
```

`.bpmnkit/` directories are safe to commit to git. They contain the stable UUID that links a file to its Camunda deployment history and test scenarios.

---

## Projects

A **Project** is a folder (typically a git repository) configured by the user. Projects are registered in the browser's IndexedDB and accessed via the proxy server.

### Project configuration (browser IndexedDB)

```typescript
interface Project {
  id: string       // UUID (browser-local stable key)
  name: string     // Display name
  path: string     // Absolute path on the machine running the proxy
  lastUsed: number // Timestamp
}
```

### Project management

Projects are managed in **Settings → Projects**:
- **Add project**: Enter a display name and the absolute folder path. The app validates the path exists by calling the proxy.
- **Switch project**: Switch the active project. All Models views reload from the new source.
- **Remove project**: Unregisters the project from the browser (does not delete files).
- **Local (default)**: Always available. Stores models in IndexedDB.

The active project is persisted in localStorage so it survives page reloads.

---

## Proxy FS API

The proxy server (`apps/proxy`, default port `3033`) exposes file system endpoints under `/fs/`. All paths must be within the specified project root (validated server-side; `..` traversal is rejected).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/fs/list?root=<abs>` | List all files with content + metadata (one-shot load) |
| `GET` | `/fs/tree?root=<abs>` | Lightweight directory tree (names + types, no content) |
| `GET` | `/fs/read?path=<abs>` | Read a single file's content |
| `POST` | `/fs/write` | Write file content `{ path, content }` |
| `DELETE` | `/fs/file?path=<abs>` | Delete file + its sidecar |
| `POST` | `/fs/move` | Move/rename file + sidecar `{ from, to }` |
| `POST` | `/fs/mkdir` | Create directory `{ path }` |
| `GET` | `/fs/meta?path=<abs>` | Read sidecar metadata for a file |
| `POST` | `/fs/meta` | Write sidecar metadata `{ path, meta }` |

### When the proxy is not running

If a project is configured but the proxy is offline, the Models page shows a banner:
> "Proxy server is not running. Start it with `pnpm proxy` to access your project files."

The user can still switch to the local mode (IndexedDB).

---

## Architecture

### Storage adapter pattern

`StorageAdapter` (in `apps/studio/src/storage/types.ts`) is the core interface. Two implementations exist:

| Class | Location | Used when |
|---|---|---|
| `IndexedDbAdapter` | `storage/indexeddb.ts` | Default / no project |
| `ProxyFsAdapter` | `storage/proxy-fs.ts` | Project selected + proxy running |

`apps/studio/src/storage/index.ts` exports a **delegating `storage` object** that forwards all calls to the currently active adapter. Calling `setActiveAdapter(adapter)` switches the active adapter at runtime (no page reload needed).

### ModelFile identity

In both modes, `ModelFile.id` is a **stable UUID**. In FS mode, the UUID is stored in the sidecar file and persists across renames and moves. URL routing (`/models/:id`) always uses the UUID.

In FS mode, `ModelFile.path` holds the **relative path from the project root** (e.g. `processes/order-process.bpmn`). This is how the FS adapter knows where to write changes.

### Test scenarios persistence

The process-runner plugin stores test scenarios in `bpmnkit-process-runner-v1` IndexedDB by default. In FS mode, `ModelDetail` passes `onSaveScenarios`/`onLoadScenarios` callbacks to the plugin that delegate to the sidecar file instead. This ensures scenarios are checked into git alongside the BPMN files.

---

## Implementation Roadmap

### Phase 1 — Proxy FS API

- [x] Add `fs` Node.js imports and path validation helper to `apps/proxy/src/index.ts`
- [x] Implement `GET /fs/tree` (lightweight directory tree)
- [x] Implement `GET /fs/list` (full content + metadata, one-shot)
- [x] Implement `GET /fs/read` (single file content)
- [x] Implement `POST /fs/write` (write file, create parent dirs)
- [x] Implement `DELETE /fs/file` (delete file + sidecar)
- [x] Implement `POST /fs/move` (move/rename file + sidecar)
- [x] Implement `POST /fs/mkdir` (create directory)
- [x] Implement `GET /fs/meta` (read sidecar)
- [x] Implement `POST /fs/meta` (write sidecar, create `.bpmnkit/` dir)

### Phase 2 — Storage types & IndexedDB v2

- [x] Extend `ModelFile` with `path?: string` and `"md"` type
- [x] Add `FsEntry`, `FileMeta`, `Project` interfaces to `storage/types.ts`
- [x] Add `FsCapableAdapter` interface with FS-specific methods
- [x] Bump `bpmnkit-studio` IndexedDB to version 2, add `projects` object store
- [x] Add project CRUD methods to `IndexedDbAdapter`

### Phase 3 — ProxyFsAdapter

- [x] Create `apps/studio/src/storage/proxy-fs.ts`
- [x] Implement `listModels()` via `/fs/list`
- [x] Implement `getModel()` via UUID→path cache
- [x] Implement `saveModel()` via `/fs/write` + `/fs/meta`
- [x] Implement `deleteModel()` via `/fs/file` DELETE
- [x] Implement `listTree()` via `/fs/tree`
- [x] Implement `moveModel()` via `/fs/move`
- [x] Implement `createFolder()` via `/fs/mkdir`
- [x] Delegate preferences to an `IndexedDbAdapter` instance

### Phase 4 — Dynamic storage switching

- [x] Refactor `apps/studio/src/storage/index.ts` to delegating proxy pattern
- [x] Export `setActiveAdapter()`, `getCurrentAdapter()`, `getFsAdapter()`

### Phase 5 — Project store

- [x] Create `apps/studio/src/stores/projects.ts`
- [x] Zustand store: `projects`, `activeProjectId`, `addProject`, `removeProject`, `setActiveProject`
- [x] On `setActiveProject`: switch adapter → reload models
- [x] Persist `activeProjectId` in localStorage

### Phase 6 — Test scenario callbacks

- [x] Add `onSaveScenarios`, `onLoadScenarios`, `onSaveInputVars`, `onLoadInputVars` to `ProcessRunnerOptions`
- [x] Use callbacks when provided (fall back to internal IndexedDB otherwise)
- [x] Wire callbacks in `ModelDetail.tsx` when in FS mode

### Phase 7 — Models store update

- [x] Add `moveModel(fromPath, toPath)` action to `useModelsStore`
- [x] Add `loadModel(id)` to force-reload a single model's content from storage

### Phase 8 — Project management UI

- [x] Add "Projects" section to `Settings.tsx`
- [x] "Add project" dialog (name + path, validation)
- [x] Project list with Switch/Remove
- [x] Show active project indicator in `TopBar.tsx`

### Phase 9 — Folder tree UI

- [x] Add `FolderTree` component to `Models.tsx`
- [x] Show folder tree when `isFsMode()` is true
- [x] Folder navigation with breadcrumbs
- [x] "New file in folder" and "New folder" buttons
- [x] File context menu: Move to..., Rename, Delete
- [x] "Move to..." dialog with folder picker
- [x] Handle `"md"` type: open markdown editor in `ModelDetail`

### Phase 10 — Markdown editor

- [x] Add markdown editor case to `ModelDetail.tsx` (simple textarea)
- [x] Auto-save on change (same 2s debounce pattern)
