export interface ModelFile {
	id: string
	name: string
	type: "bpmn" | "dmn" | "form" | "md"
	content: string
	/** Relative path from project root — only set in FS mode. */
	path?: string
	/** Virtual folder path for IndexedDB mode (e.g. "processes" or "processes/orders"). */
	folder?: string
	processDefinitionId?: string
	/** Persisted JSON string of variables used when starting new instances. */
	runVariables?: string
	createdAt: number
	updatedAt: number
	tags?: string[]
}

/** A node in the project file tree returned by the FS adapter. */
export interface FsEntry {
	name: string
	/** Relative path from project root (e.g. "processes/order.bpmn"). */
	relativePath: string
	type: "dir" | "file"
	fileType?: "bpmn" | "dmn" | "form" | "md"
	children?: FsEntry[]
}

/**
 * Sidecar metadata stored alongside a model file in `.bpmnkit/<file>.meta.json`.
 * Keeps the stable UUID, deployment link, test scenarios, and other metadata
 * next to the source file so it can be checked into git.
 */
export interface FileMeta {
	id: string
	processDefinitionId?: string
	runVariables?: string
	tags?: string[]
	createdAt: number
	/** Test scenarios — typed as unknown[] to avoid a hard dep on the plugin package. */
	scenarios?: unknown[]
	inputVars?: Array<{ name: string; value: string }>
}

/** A project folder configured by the user, stored in browser IndexedDB. */
export interface Project {
	id: string
	name: string
	/** Absolute path on the machine running the proxy. */
	path: string
	lastUsed: number
}

export interface StorageAdapter {
	listModels(): Promise<ModelFile[]>
	getModel(id: string): Promise<ModelFile | null>
	saveModel(model: Omit<ModelFile, "updatedAt">): Promise<ModelFile>
	deleteModel(id: string): Promise<void>
	getPreference<T>(key: string, fallback: T): Promise<T>
	setPreference<T>(key: string, value: T): Promise<void>
}

/** Extended adapter interface for file-system-backed storage. */
export interface FsCapableAdapter extends StorageAdapter {
	readonly supportsFs: true
	listTree(): Promise<FsEntry[]>
	moveModel(fromRelPath: string, toRelPath: string): Promise<ModelFile>
	createFolder(relPath: string): Promise<void>
	saveMeta(relPath: string, meta: FileMeta): Promise<void>
	loadMeta(relPath: string): Promise<FileMeta | null>
}

export function isFsAdapter(a: StorageAdapter): a is FsCapableAdapter {
	return (a as FsCapableAdapter).supportsFs === true
}
