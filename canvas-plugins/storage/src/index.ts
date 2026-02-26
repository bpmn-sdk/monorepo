import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import type { MainMenuApi, MenuItem } from "@bpmn-sdk/canvas-plugin-main-menu";
import { Bpmn } from "@bpmn-sdk/core";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { StorageApi, type StorageApiOptions } from "./storage-api.js";
import type { FileType, ProjectRecord, WorkspaceRecord } from "./types.js";

export type {
	FileType,
	WorkspaceRecord,
	ProjectRecord,
	FileRecord,
	FileContentRecord,
} from "./types.js";
export { StorageApi } from "./storage-api.js";
export type { StorageApiOptions } from "./storage-api.js";

// ─── Plugin factory ───────────────────────────────────────────────────────────

/** Options for {@link createStoragePlugin}. */
export interface StoragePluginOptions extends StorageApiOptions {
	/** The main menu plugin instance (must have an `api` property). */
	mainMenu: CanvasPlugin & { api: MainMenuApi };
	/** Returns the currently open tabs with their latest content. */
	getOpenTabs(): Array<{ tabId: string; name: string; type: FileType; content: string }>;
	/** Title to restore when leaving a project. Defaults to "". */
	initialTitle?: string;
}

/**
 * Creates an IndexedDB-backed storage plugin.
 *
 * Integrates with the main menu plugin to provide workspace/project navigation
 * via drill-down menus. Auto-saves BPMN changes with a 500 ms debounce.
 * Persists the last-opened project across page refreshes.
 */
export function createStoragePlugin(
	options: StoragePluginOptions,
): CanvasPlugin & { api: StorageApi } {
	const storageApi = new StorageApi(options);
	let offDiagramChange: (() => void) | undefined;
	let offChange: (() => void) | undefined;

	// Cast helper for editor events that extend CanvasEvents at runtime
	type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void;

	function getProjectLabel(projectId: string): string {
		const workspaces = storageApi.getCachedWorkspaces();
		for (const ws of workspaces) {
			const projects = storageApi.getCachedProjects(ws.id);
			const p = projects.find((pr) => pr.id === projectId);
			if (p) return `${ws.name} / ${p.name}`;
		}
		return "Project";
	}

	function buildWorkspaceDrillItems(
		onProjectClick: (ws: WorkspaceRecord, proj: ProjectRecord) => void,
	): MenuItem[] {
		const workspaces = storageApi.getCachedWorkspaces();
		if (workspaces.length === 0) {
			return [
				{
					type: "info",
					text: "No workspaces yet",
					actionLabel: "Create",
					onAction: () => {
						void handleCreateWorkspace(onProjectClick);
					},
				},
			];
		}

		const items: MenuItem[] = [];
		for (const ws of workspaces) {
			items.push({
				type: "drill",
				label: ws.name,
				items: () => buildProjectDrillItems(ws, onProjectClick),
			});
		}
		items.push({ type: "separator" });
		items.push({
			label: "New Workspace…",
			onClick: () => void handleCreateWorkspace(onProjectClick),
		});
		return items;
	}

	function buildProjectDrillItems(
		ws: WorkspaceRecord,
		onProjectClick: (ws: WorkspaceRecord, proj: ProjectRecord) => void,
	): MenuItem[] {
		const projects = storageApi.getCachedProjects(ws.id);
		const items: MenuItem[] = [];

		if (projects.length === 0) {
			items.push({ type: "info", text: "No projects yet" });
		}

		for (const proj of projects) {
			items.push({
				label: proj.name,
				onClick: () => onProjectClick(ws, proj),
			});
		}
		items.push({ type: "separator" });
		items.push({
			label: "New Project…",
			onClick: () => void handleCreateProject(ws, onProjectClick),
		});
		items.push({
			label: "Rename Workspace…",
			onClick: () =>
				void storageApi.renameWorkspace(ws.id, prompt("New name:", ws.name)?.trim() ?? ws.name),
		});
		items.push({
			label: "Delete Workspace",
			onClick: () => {
				if (confirm(`Delete workspace "${ws.name}" and all its data?`)) {
					void storageApi.deleteWorkspace(ws.id);
				}
			},
		});
		return items;
	}

	async function handleCreateWorkspace(
		onProjectClick: (ws: WorkspaceRecord, proj: ProjectRecord) => void,
	): Promise<void> {
		const name = prompt("Workspace name:")?.trim();
		if (!name) return;
		await storageApi.createWorkspace(name);
		// Trigger menu rebuild on next open via notify
	}

	async function handleCreateProject(
		ws: WorkspaceRecord,
		onProjectClick: (ws: WorkspaceRecord, proj: ProjectRecord) => void,
	): Promise<void> {
		const name = prompt("Project name:")?.trim();
		if (!name) return;
		await storageApi.createProject(ws.id, name);
	}

	function buildDynamicItems(): MenuItem[] {
		const currentProjectId = storageApi.getCurrentProjectId();
		const items: MenuItem[] = [];

		if (currentProjectId) {
			items.push({
				type: "info",
				text: getProjectLabel(currentProjectId),
				actionLabel: "Leave",
				onAction: () => {
					storageApi.setCurrentProjectId(null);
					options.mainMenu.api.setTitle(options.initialTitle ?? "");
				},
			});
			items.push({ type: "separator" });
		}

		items.push({
			type: "drill",
			label: "Open Project",
			items: () =>
				buildWorkspaceDrillItems((ws, proj) => {
					void storageApi.openProject(proj.id).then(() => {
						options.mainMenu.api.setTitle(`${ws.name} / ${proj.name}`);
					});
				}),
		});

		items.push({
			type: "drill",
			label: "Save All to Project…",
			items: () =>
				buildWorkspaceDrillItems((ws, proj) => {
					const tabs = options.getOpenTabs();
					void storageApi.saveTabsToProject(proj.id, ws.id, tabs).then(() => {
						options.mainMenu.api.setTitle(`${ws.name} / ${proj.name}`);
					});
				}),
		});

		items.push({ type: "separator" });
		return items;
	}

	return {
		name: "storage",
		api: storageApi,

		install(canvasApi: CanvasApi) {
			// Register dynamic items supplier
			options.mainMenu.api.setDynamicItems(buildDynamicItems);

			// Initialize: load caches and restore last-opened project
			void storageApi.initialize().then((files) => {
				const projectId = storageApi.getCurrentProjectId();
				if (files && projectId) {
					const label = getProjectLabel(projectId);
					if (label !== "Project") {
						options.mainMenu.api.setTitle(label);
					}
					// Files already opened via onOpenFile callbacks inside openProject
					// But initialize() just returns them — call openFile for each
					for (const file of files) {
						void storageApi.openFile(file.id);
					}
				}
			});

			// Rebuild dynamic items next time menu opens when data changes
			offChange = storageApi.onChange(() => {
				options.mainMenu.api.setDynamicItems(buildDynamicItems);
			});

			// Subscribe to diagram:change for auto-save
			const anyOn = canvasApi.on.bind(canvasApi) as unknown as AnyOn;
			offDiagramChange = anyOn("diagram:change", (rawDefs) => {
				const currentId = storageApi.getCurrentFileId();
				if (!currentId) return;
				const defs = rawDefs as BpmnDefinitions;
				const xml = Bpmn.export(defs);
				storageApi.scheduleSave(currentId, xml);
			});
		},

		uninstall() {
			offDiagramChange?.();
			offChange?.();
			void storageApi.flush();
		},
	};
}
