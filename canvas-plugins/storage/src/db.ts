import Dexie, { type Table } from "dexie";
import type { FileContentRecord, FileRecord, ProjectRecord, WorkspaceRecord } from "./types.js";

class StorageDatabase extends Dexie {
	workspaces!: Table<WorkspaceRecord, string>;
	projects!: Table<ProjectRecord, string>;
	files!: Table<FileRecord, string>;
	fileContents!: Table<FileContentRecord, string>;

	constructor() {
		super("bpmn-sdk-storage");
		this.version(1).stores({
			workspaces: "id, name",
			projects: "id, workspaceId",
			files: "id, projectId, workspaceId",
			fileContents: "fileId",
		});
	}
}

export const db = new StorageDatabase();
