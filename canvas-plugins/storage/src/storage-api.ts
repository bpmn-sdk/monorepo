import { AutoSave } from "./auto-save.js";
import { db } from "./db.js";
import type {
	FileContentRecord,
	FileRecord,
	FileType,
	ProjectRecord,
	WorkspaceRecord,
} from "./types.js";

export interface StorageApiOptions {
	/** Called when the user opens a file from the sidebar. */
	onOpenFile(file: FileRecord, content: string): void;
}

function now(): number {
	return Date.now();
}

function newId(): string {
	return crypto.randomUUID();
}

export class StorageApi {
	private _currentFileId: string | null = null;
	private readonly _autoSave: AutoSave;
	private _listeners: Array<() => void> = [];

	constructor(private readonly _options: StorageApiOptions) {
		this._autoSave = new AutoSave(async (fileId, content) => {
			await this._persistContent(fileId, content);
			this._notify();
		});
	}

	// ─── Workspaces ──────────────────────────────────────────────────────────────

	async createWorkspace(name: string): Promise<WorkspaceRecord> {
		const ws: WorkspaceRecord = { id: newId(), name, createdAt: now(), updatedAt: now() };
		await db.workspaces.add(ws);
		this._notify();
		return ws;
	}

	async getWorkspaces(): Promise<WorkspaceRecord[]> {
		return db.workspaces.orderBy("name").toArray();
	}

	async renameWorkspace(id: string, name: string): Promise<void> {
		await db.workspaces.update(id, { name, updatedAt: now() });
		this._notify();
	}

	async deleteWorkspace(id: string): Promise<void> {
		const projects = await db.projects.where("workspaceId").equals(id).toArray();
		for (const p of projects) await this._deleteProjectData(p.id);
		await db.workspaces.delete(id);
		if (this._currentFileId !== null) {
			const f = await db.files.get(this._currentFileId);
			if (!f || f.workspaceId === id) this._currentFileId = null;
		}
		this._notify();
	}

	// ─── Projects ────────────────────────────────────────────────────────────────

	async createProject(workspaceId: string, name: string): Promise<ProjectRecord> {
		const p: ProjectRecord = { id: newId(), workspaceId, name, createdAt: now(), updatedAt: now() };
		await db.projects.add(p);
		this._notify();
		return p;
	}

	async getProjects(workspaceId: string): Promise<ProjectRecord[]> {
		return db.projects.where("workspaceId").equals(workspaceId).sortBy("name");
	}

	async renameProject(id: string, name: string): Promise<void> {
		await db.projects.update(id, { name, updatedAt: now() });
		this._notify();
	}

	async deleteProject(id: string): Promise<void> {
		await this._deleteProjectData(id);
		this._notify();
	}

	private async _deleteProjectData(projectId: string): Promise<void> {
		const files = await db.files.where("projectId").equals(projectId).toArray();
		for (const f of files) {
			await db.fileContents.delete(f.id);
			if (this._currentFileId === f.id) this._currentFileId = null;
		}
		await db.files.where("projectId").equals(projectId).delete();
		await db.projects.delete(projectId);
	}

	// ─── Files ───────────────────────────────────────────────────────────────────

	async createFile(
		projectId: string,
		workspaceId: string,
		name: string,
		type: FileType,
		content: string,
	): Promise<FileRecord> {
		const file: FileRecord = {
			id: newId(),
			projectId,
			workspaceId,
			name,
			type,
			isShared: false,
			gitPath: null,
			createdAt: now(),
			updatedAt: now(),
		};
		const fc: FileContentRecord = { fileId: file.id, content, version: 1 };
		await db.files.add(file);
		await db.fileContents.add(fc);
		this._notify();
		return file;
	}

	async getFiles(projectId: string): Promise<FileRecord[]> {
		return db.files.where("projectId").equals(projectId).sortBy("name");
	}

	async getSharedFiles(): Promise<FileRecord[]> {
		return db.files.filter((f) => f.isShared).toArray();
	}

	async getFileContent(fileId: string): Promise<string | null> {
		const fc = await db.fileContents.get(fileId);
		return fc?.content ?? null;
	}

	async renameFile(id: string, name: string): Promise<void> {
		await db.files.update(id, { name, updatedAt: now() });
		this._notify();
	}

	async setFileShared(id: string, isShared: boolean): Promise<void> {
		await db.files.update(id, { isShared, updatedAt: now() });
		this._notify();
	}

	async deleteFile(id: string): Promise<void> {
		await db.fileContents.delete(id);
		await db.files.delete(id);
		if (this._currentFileId === id) this._currentFileId = null;
		this._notify();
	}

	// ─── Navigation ──────────────────────────────────────────────────────────────

	async openFile(fileId: string): Promise<void> {
		const file = await db.files.get(fileId);
		if (!file) return;
		const content = await this.getFileContent(fileId);
		if (content === null) return;
		this._currentFileId = fileId;
		this._options.onOpenFile(file, content);
		this._notify();
	}

	getCurrentFileId(): string | null {
		return this._currentFileId;
	}

	setCurrentFileId(id: string | null): void {
		this._currentFileId = id;
	}

	// ─── Auto-save ───────────────────────────────────────────────────────────────

	scheduleSave(fileId: string, content: string): void {
		this._autoSave.schedule(fileId, content);
	}

	async flush(): Promise<void> {
		await this._autoSave.flush();
	}

	private async _persistContent(fileId: string, content: string): Promise<void> {
		const existing = await db.fileContents.get(fileId);
		if (existing) {
			await db.fileContents.update(fileId, { content, version: existing.version + 1 });
		} else {
			await db.fileContents.add({ fileId, content, version: 1 });
		}
		await db.files.update(fileId, { updatedAt: now() });
	}

	// ─── Change listeners ─────────────────────────────────────────────────────────

	onChange(cb: () => void): () => void {
		this._listeners.push(cb);
		return () => {
			this._listeners = this._listeners.filter((l) => l !== cb);
		};
	}

	private _notify(): void {
		for (const l of this._listeners) l();
	}
}
