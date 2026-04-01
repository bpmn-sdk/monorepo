import { IndexedDbAdapter } from "./indexeddb.js"
import { ProxyFsAdapter } from "./proxy-fs.js"
import type { FsCapableAdapter, StorageAdapter } from "./types.js"

export type {
	FileMeta,
	FsCapableAdapter,
	FsEntry,
	ModelFile,
	Project,
	StorageAdapter,
} from "./types.js"
export { isFsAdapter } from "./types.js"
export { sharedIndexedDb } from "./indexeddb.js"
export { ProxyFsAdapter } from "./proxy-fs.js"

let _current: StorageAdapter = new IndexedDbAdapter()

/** Switch the active storage backend at runtime (no page reload needed). */
export function setActiveAdapter(adapter: StorageAdapter): void {
	_current = adapter
}

export function getCurrentAdapter(): StorageAdapter {
	return _current
}

/** Returns the current adapter as an FsCapableAdapter, or null if not in FS mode. */
export function getFsAdapter(): FsCapableAdapter | null {
	const a = _current as Partial<FsCapableAdapter>
	return a.supportsFs === true ? (a as FsCapableAdapter) : null
}

export function isFsMode(): boolean {
	return getFsAdapter() !== null
}

/**
 * Delegating storage object — all calls are forwarded to the currently active
 * adapter. Callers that hold a reference to `storage` always talk to whichever
 * adapter is currently active.
 */
export const storage: StorageAdapter = {
	listModels: () => _current.listModels(),
	getModel: (id) => _current.getModel(id),
	saveModel: (m) => _current.saveModel(m),
	deleteModel: (id) => _current.deleteModel(id),
	getPreference: (k, f) => _current.getPreference(k, f),
	setPreference: (k, v) => _current.setPreference(k, v),
}

// Re-export the adapter classes for places that need to instantiate them.
export { IndexedDbAdapter }
