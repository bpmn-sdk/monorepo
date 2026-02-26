import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import { Bpmn } from "@bpmn-sdk/core";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { injectStorageStyles } from "./css.js";
import { StorageSidebar } from "./sidebar.js";
import { StorageApi, type StorageApiOptions } from "./storage-api.js";

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
export interface StoragePluginOptions extends StorageApiOptions {}

/**
 * Creates an IndexedDB-backed storage plugin.
 *
 * The plugin stores BPMN / DMN / Form files in a `workspace → project → files`
 * hierarchy persisted in the browser's IndexedDB. It adds a toggleable file-tree
 * sidebar to the editor container and auto-saves BPMN changes with a 500 ms debounce.
 *
 * @example
 * ```typescript
 * const storagePlugin = createStoragePlugin({
 *   onOpenFile(file, content) {
 *     if (file.type === "bpmn") tabsPlugin.api.openTab({ type: "bpmn", xml: content, name: file.name });
 *   },
 * });
 * ```
 */
export function createStoragePlugin(
	options: StoragePluginOptions,
): CanvasPlugin & { api: StorageApi } {
	const storageApi = new StorageApi(options);
	let sidebar: StorageSidebar | undefined;
	let offDiagramChange: (() => void) | undefined;

	// Cast helper for editor events that extend CanvasEvents at runtime
	type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void;

	return {
		name: "storage",
		api: storageApi,

		install(canvasApi: CanvasApi) {
			injectStorageStyles();
			sidebar = new StorageSidebar(canvasApi.container, storageApi);

			// Subscribe to diagram:change (BpmnEditor extends CanvasEvents at runtime)
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
			void storageApi.flush();
			sidebar?.destroy();
		},
	};
}
