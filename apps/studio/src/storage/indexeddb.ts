import type { FileMeta, ModelFile, Project, StorageAdapter } from "./types.js"

const DB_NAME = "bpmnkit-studio"
const DB_VERSION = 2

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)

		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result
			if (!db.objectStoreNames.contains("models")) {
				db.createObjectStore("models", { keyPath: "id" })
			}
			if (!db.objectStoreNames.contains("preferences")) {
				db.createObjectStore("preferences", { keyPath: "key" })
			}
			// v2: project registry
			if (!db.objectStoreNames.contains("projects")) {
				db.createObjectStore("projects", { keyPath: "id" })
			}
		}

		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

function tx<T>(
	db: IDBDatabase,
	store: string,
	mode: IDBTransactionMode,
	fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = db.transaction(store, mode)
		const s = t.objectStore(store)
		const req = fn(s)
		req.onsuccess = () => resolve(req.result as T)
		req.onerror = () => reject(req.error)
	})
}

export class IndexedDbAdapter implements StorageAdapter {
	private _db: Promise<IDBDatabase>

	constructor() {
		this._db = openDb()
	}

	async listModels(): Promise<ModelFile[]> {
		const db = await this._db
		return tx<ModelFile[]>(db, "models", "readonly", (s) => s.getAll())
	}

	async getModel(id: string): Promise<ModelFile | null> {
		const db = await this._db
		const result = await tx<ModelFile | undefined>(db, "models", "readonly", (s) => s.get(id))
		return result ?? null
	}

	async saveModel(model: Omit<ModelFile, "updatedAt">): Promise<ModelFile> {
		const db = await this._db
		const now = Date.now()
		const full: ModelFile = {
			...model,
			id: model.id || crypto.randomUUID(),
			createdAt: model.createdAt || now,
			updatedAt: now,
		}
		await tx(db, "models", "readwrite", (s) => s.put(full))
		return full
	}

	async deleteModel(id: string): Promise<void> {
		const db = await this._db
		await tx(db, "models", "readwrite", (s) => s.delete(id))
	}

	async getPreference<T>(key: string, fallback: T): Promise<T> {
		const db = await this._db
		const result = await tx<{ key: string; value: T } | undefined>(
			db,
			"preferences",
			"readonly",
			(s) => s.get(key),
		)
		return result?.value ?? fallback
	}

	async setPreference<T>(key: string, value: T): Promise<void> {
		const db = await this._db
		await tx(db, "preferences", "readwrite", (s) => s.put({ key, value }))
	}

	// ── Project registry ─────────────────────────────────────────────────────

	async listProjects(): Promise<Project[]> {
		const db = await this._db
		return tx<Project[]>(db, "projects", "readonly", (s) => s.getAll())
	}

	async saveProject(project: Project): Promise<void> {
		const db = await this._db
		await tx(db, "projects", "readwrite", (s) => s.put(project))
	}

	async deleteProject(id: string): Promise<void> {
		const db = await this._db
		await tx(db, "projects", "readwrite", (s) => s.delete(id))
	}
}

// Shared instance used for project registry and preferences when in FS mode.
export const sharedIndexedDb = new IndexedDbAdapter()

// Stub that satisfies FileMeta usage in proxy-fs — kept here to avoid circular imports.
export type { FileMeta }
