import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import { DmnViewer } from "@bpmn-sdk/canvas-plugin-dmn-viewer";
import { FormViewer } from "@bpmn-sdk/canvas-plugin-form-viewer";
import type { DmnDefinitions, FormDefinition } from "@bpmn-sdk/core";
import { injectTabsStyles } from "./css.js";
import type { FileResolver } from "./file-resolver.js";

/** A tab configuration — one of BPMN, DMN, or Form. */
export type TabConfig =
	| { type: "bpmn"; xml: string; name?: string }
	| { type: "dmn"; defs: DmnDefinitions; name?: string }
	| { type: "form"; form: FormDefinition; name?: string };

/** Internal tab state. */
interface TabState {
	id: string;
	config: TabConfig;
	pane: HTMLDivElement;
	tabEl: HTMLDivElement;
	dmnViewer?: DmnViewer;
	formViewer?: FormViewer;
}

/** Options for the tabs plugin. */
export interface TabsPluginOptions {
	/**
	 * File resolver used to open referenced DMN/form files by ID.
	 * Provide an `InMemoryFileResolver` (or custom implementation)
	 * to enable "Open Decision" / "Open Form" navigation.
	 */
	resolver?: FileResolver;
}

/** Public API for the tabs plugin, accessible via `tabsPlugin.api`. */
export interface TabsApi {
	/** Open a new tab (or activate it if already open). Returns the tab ID. */
	openTab(config: TabConfig): string;
	/** Close a tab by ID. */
	closeTab(id: string): void;
	/** Activate a tab by ID. */
	setActiveTab(id: string): void;
	/** Get the active tab ID. */
	getActiveTabId(): string | null;
	/** Get all open tab IDs. */
	getTabIds(): string[];
	/**
	 * Open the DMN decision referenced by `decisionId` using the resolver.
	 * Shows a warning in the tab if the decision is not found.
	 */
	openDecision(decisionId: string, resultVariable?: string): void;
	/**
	 * Open the form referenced by `formId` using the resolver.
	 * Shows a warning in the tab if the form is not found.
	 */
	openForm(formId: string): void;
}

let _tabCounter = 0;

/**
 * Creates a tabs plugin instance.
 *
 * When installed into a `BpmnCanvas` (or `BpmnEditor`), it adds a tab bar overlay
 * at the top of the canvas container and manages multiple BPMN/DMN/Form views.
 *
 * @example
 * ```typescript
 * const resolver = new InMemoryFileResolver();
 * resolver.registerDmn(dmnDefs);
 * resolver.registerForm(formDef);
 *
 * const tabsPlugin = createTabsPlugin({ resolver });
 * const canvas = new BpmnCanvas({ container, xml, plugins: [tabsPlugin] });
 *
 * // Navigate programmatically
 * tabsPlugin.api.openDecision("Decision_1");
 * ```
 */
export function createTabsPlugin(options: TabsPluginOptions = {}): CanvasPlugin & { api: TabsApi } {
	const resolver = options.resolver ?? null;
	const tabs: TabState[] = [];
	let activeId: string | null = null;
	let canvasApi: CanvasApi | null = null;
	let tabBar: HTMLDivElement | null = null;
	let contentArea: HTMLDivElement | null = null;
	let theme: "dark" | "light" = "dark";

	// --- Tab Bar management ---

	function createTabEl(tab: TabState, isActive: boolean): void {
		const el = document.createElement("div");
		el.className = `bpmn-tab${isActive ? " active" : ""}`;
		el.dataset.tabId = tab.id;

		const typeBadge = document.createElement("span");
		typeBadge.className = `bpmn-tab-type ${tab.config.type}`;
		typeBadge.textContent = tab.config.type.toUpperCase();
		el.appendChild(typeBadge);

		const nameEl = document.createElement("span");
		nameEl.className = "bpmn-tab-name";
		nameEl.textContent = tab.config.name ?? `${tab.config.type} ${tab.id.slice(-4)}`;
		el.appendChild(nameEl);

		// Warn indicator (shown when referenced file not found)
		const warnEl = document.createElement("span");
		warnEl.className = "bpmn-tab-warn";
		warnEl.style.display = "none";
		warnEl.textContent = "⚠";
		warnEl.title = "Referenced file not found in registry";
		el.appendChild(warnEl);

		const closeBtn = document.createElement("span");
		closeBtn.className = "bpmn-tab-close";
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			api.closeTab(tab.id);
		});
		el.appendChild(closeBtn);

		el.addEventListener("click", () => api.setActiveTab(tab.id));

		tab.tabEl = el;
		tabBar?.appendChild(el);
	}

	function showWarning(tab: TabState, show: boolean): void {
		const warn = tab.tabEl.querySelector(".bpmn-tab-warn") as HTMLElement | null;
		if (warn) warn.style.display = show ? "" : "none";
	}

	function mountTabContent(tab: TabState): void {
		const pane = document.createElement("div");
		pane.className = "bpmn-tab-pane hidden";
		contentArea?.appendChild(pane);
		tab.pane = pane;

		if (tab.config.type === "dmn") {
			tab.dmnViewer = new DmnViewer({ container: pane, theme });
			tab.dmnViewer.load(tab.config.defs);
		} else if (tab.config.type === "form") {
			tab.formViewer = new FormViewer({ container: pane, theme });
			tab.formViewer.load(tab.config.form);
		} else if (tab.config.type === "bpmn") {
			// BPMN tabs: the main canvas SVG is shown; additional BPMN panes show read-only info
			const bpmnNote = document.createElement("div");
			bpmnNote.style.cssText =
				"padding:16px;font-size:13px;color:var(--dmn-fg,#cdd6f4);font-family:sans-serif;";
			bpmnNote.textContent = `BPMN: ${tab.config.name ?? tab.config.xml.slice(0, 60)}…`;
			pane.appendChild(bpmnNote);
		}
	}

	function applyThemeToTab(tab: TabState): void {
		tab.dmnViewer?.setTheme(theme);
		tab.formViewer?.setTheme(theme);
	}

	// --- Public API ---

	const api: TabsApi = {
		openTab(config: TabConfig): string {
			const id = `tab_${++_tabCounter}`;
			const tab: TabState = {
				id,
				config,
				pane: null as unknown as HTMLDivElement,
				tabEl: null as unknown as HTMLDivElement,
			};
			tabs.push(tab);

			if (tabBar && contentArea) {
				createTabEl(tab, false);
				mountTabContent(tab);
			}

			api.setActiveTab(id);
			return id;
		},

		closeTab(id: string): void {
			const idx = tabs.findIndex((t) => t.id === id);
			if (idx === -1) return;
			const [tab] = tabs.splice(idx, 1);
			if (!tab) return;

			tab.dmnViewer?.destroy();
			tab.formViewer?.destroy();
			tab.pane.remove();
			tab.tabEl.remove();

			if (activeId === id) {
				// Activate the next available tab
				const next = tabs[idx] ?? tabs[idx - 1];
				activeId = null;
				if (next) {
					api.setActiveTab(next.id);
				} else if (canvasApi) {
					// Restore main canvas when all non-bpmn tabs closed
					const svg = canvasApi.svg;
					if (svg.parentElement) svg.parentElement.style.display = "";
				}
			}
		},

		setActiveTab(id: string): void {
			const tab = tabs.find((t) => t.id === id);
			if (!tab) return;

			// Deactivate current
			if (activeId) {
				const prev = tabs.find((t) => t.id === activeId);
				if (prev) {
					prev.tabEl.classList.remove("active");
					prev.pane.classList.add("hidden");
				}
			}

			// Activate new
			activeId = id;
			tab.tabEl.classList.add("active");
			tab.pane.classList.remove("hidden");
		},

		getActiveTabId(): string | null {
			return activeId;
		},

		getTabIds(): string[] {
			return tabs.map((t) => t.id);
		},

		openDecision(decisionId: string): void {
			// Check if already open
			const existing = tabs.find(
				(t) => t.config.type === "dmn" && t.config.defs.decisions.some((d) => d.id === decisionId),
			);
			if (existing) {
				api.setActiveTab(existing.id);
				return;
			}

			const defs = resolver?.resolveDmn(decisionId) ?? null;
			if (!defs) {
				// Open a tab with a warning
				const id = api.openTab({
					type: "dmn",
					defs: {
						id: decisionId,
						name: decisionId,
						namespace: "",
						namespaces: {},
						modelerAttributes: {},
						decisions: [],
					},
					name: decisionId,
				});
				const tab = tabs.find((t) => t.id === id);
				if (tab) showWarning(tab, true);
				return;
			}

			const decision = defs.decisions.find((d) => d.id === decisionId);
			api.openTab({ type: "dmn", defs, name: decision?.name ?? decisionId });
		},

		openForm(formId: string): void {
			// Check if already open
			const existing = tabs.find((t) => t.config.type === "form" && t.config.form.id === formId);
			if (existing) {
				api.setActiveTab(existing.id);
				return;
			}

			const form = resolver?.resolveForm(formId) ?? null;
			if (!form) {
				const id = api.openTab({
					type: "form",
					form: { id: formId, type: "default", components: [] },
					name: formId,
				});
				const tab = tabs.find((t) => t.id === id);
				if (tab) showWarning(tab, true);
				return;
			}

			api.openTab({ type: "form", form, name: form.id });
		},
	};

	// --- CanvasPlugin ---

	return {
		name: "tabs",
		api,

		install(cApi: CanvasApi): void {
			canvasApi = cApi;
			injectTabsStyles();

			// Detect theme from canvas
			const container = cApi.container;
			const themeAttr = container.dataset.bpmnTheme;
			if (themeAttr === "light") theme = "light";

			// Expand container to be position:relative for absolute children
			if (getComputedStyle(container).position === "static") {
				container.style.position = "relative";
			}

			// Create tab bar
			tabBar = document.createElement("div");
			tabBar.className = "bpmn-tabs";
			tabBar.dataset.theme = theme;
			container.appendChild(tabBar);

			// Create content area (below tab bar)
			contentArea = document.createElement("div");
			contentArea.className = "bpmn-tab-content";
			container.appendChild(contentArea);

			// Open the initial BPMN tab for the loaded diagram
			const initId = api.openTab({ type: "bpmn", name: "Diagram", xml: "" });

			// Hide our BPMN placeholder pane — the canvas SVG IS the BPMN view
			const bpmnTab = tabs.find((t) => t.id === initId);
			if (bpmnTab) bpmnTab.pane.style.display = "none";

			// Listen for theme changes
			const observer = new MutationObserver(() => {
				const t = container.dataset.bpmnTheme;
				theme = t === "light" ? "light" : "dark";
				if (tabBar) tabBar.dataset.theme = theme;
				for (const tab of tabs) applyThemeToTab(tab);
			});
			observer.observe(container, { attributes: true, attributeFilter: ["data-bpmn-theme"] });
		},

		uninstall(): void {
			for (const tab of tabs) {
				tab.dmnViewer?.destroy();
				tab.formViewer?.destroy();
			}
			tabs.length = 0;
			activeId = null;
			tabBar?.remove();
			contentArea?.remove();
			tabBar = null;
			contentArea = null;
			canvasApi = null;
		},
	};
}
