import { IndexedDbAdapter } from "./indexeddb.js"
import type { StorageAdapter } from "./types.js"

export type { ModelFile, StorageAdapter } from "./types.js"

// Detect Tauri runtime — TauriAdapter would be loaded dynamically in studio-desktop
const isTauri =
	typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"

export const storage: StorageAdapter = isTauri
	? // In Tauri mode, the desktop app should inject the adapter before mounting.
		// For now fall back to IndexedDB if no injection has occurred.
		new IndexedDbAdapter()
	: new IndexedDbAdapter()
