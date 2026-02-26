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
	hasWarning: boolean;
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
	/**
	 * Called whenever a tab becomes active.
	 * Use this to react to tab switches — e.g. reload the BPMN editor
	 * when a BPMN tab is activated.
	 */
	onTabActivate?: (id: string, config: TabConfig) => void;
	/**
	 * Called when the user confirms they want to download a tab's content
	 * before closing. Implement file serialization and browser download here.
	 * If not provided, the "Download & Close" button is hidden.
	 */
	onDownloadTab?: (config: TabConfig) => void;
	/**
	 * Called when the user clicks "New diagram" on the welcome screen.
	 * Open a new BPMN tab from here.
	 */
	onNewDiagram?: () => void;
	/**
	 * Called when the user clicks "Import files" on the welcome screen.
	 * Trigger your file-picker here.
	 */
	onImportFiles?: () => void;
	/**
	 * Called whenever the welcome screen becomes visible (on initial install
	 * and when the last tab is closed). Use this to hide toolbars and menus
	 * that have no meaning without an open diagram.
	 */
	onWelcomeShow?: () => void;
	/**
	 * Example items shown in the welcome screen. Each item has a label,
	 * optional description, optional badge (e.g. "BPMN", "MULTI"), and an
	 * `onOpen` callback that opens the relevant tab(s).
	 */
	examples?: WelcomeExample[];
}

/** A single example entry shown on the welcome screen. */
export interface WelcomeExample {
	label: string;
	description?: string;
	/** Short badge text, e.g. "BPMN", "DMN", "FORM", "MULTI". */
	badge?: string;
	onOpen: () => void;
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

/** The order in which type groups appear in the tab bar. */
const GROUP_TYPES: Array<TabConfig["type"]> = ["bpmn", "dmn", "form"];

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
	let welcomeEl: HTMLDivElement | null = null;
	let dropdownEl: HTMLDivElement | null = null;
	let theme: "dark" | "light" = "dark";

	/** Tracks the last-activated tab ID per type group. */
	const groupActiveId = new Map<TabConfig["type"], string>();
	/** Which type group's dropdown is currently open, if any. */
	let openDropdownType: TabConfig["type"] | null = null;
	let outsideClickHandler: ((e: PointerEvent) => void) | null = null;

	// --- Close-confirmation dialog ---

	/** Returns true when a tab has in-memory content worth offering to save. */
	function hasContent(config: TabConfig): boolean {
		// A BPMN tab with xml:"" represents the main canvas — skip dialog for it.
		if (config.type === "bpmn") return config.xml.length > 0;
		return true; // dmn and form always carry parsed content
	}

	/**
	 * Shows an in-canvas confirmation dialog asking the user whether to download
	 * the tab's content before closing.
	 */
	function showCloseDialog(
		container: HTMLElement,
		tabName: string,
		onDownload: (() => void) | null,
		onClose: () => void,
	): void {
		const overlay = document.createElement("div");
		overlay.className = "bpmn-close-overlay";

		const dialog = document.createElement("div");
		dialog.className = "bpmn-close-dialog";
		dialog.dataset.theme = theme;

		const titleEl = document.createElement("div");
		titleEl.className = "bpmn-close-dialog-title";
		titleEl.textContent = `Close "${tabName}"?`;

		const bodyEl = document.createElement("div");
		bodyEl.className = "bpmn-close-dialog-body";
		bodyEl.textContent =
			"This file only exists in memory and will be lost. Download a copy before closing?";

		const actionsEl = document.createElement("div");
		actionsEl.className = "bpmn-close-dialog-actions";

		function dismiss(): void {
			overlay.remove();
			document.removeEventListener("keydown", handleKey);
		}

		const cancelBtn = document.createElement("button");
		cancelBtn.type = "button";
		cancelBtn.className = "bpmn-close-dialog-btn ghost";
		cancelBtn.textContent = "Cancel";
		cancelBtn.addEventListener("click", dismiss);

		const discardBtn = document.createElement("button");
		discardBtn.type = "button";
		discardBtn.className = "bpmn-close-dialog-btn secondary";
		discardBtn.textContent = "Close without saving";
		discardBtn.addEventListener("click", () => {
			dismiss();
			onClose();
		});

		actionsEl.appendChild(cancelBtn);
		actionsEl.appendChild(discardBtn);

		if (onDownload) {
			const downloadBtn = document.createElement("button");
			downloadBtn.type = "button";
			downloadBtn.className = "bpmn-close-dialog-btn primary";
			downloadBtn.textContent = "Download & Close";
			downloadBtn.addEventListener("click", () => {
				dismiss();
				onDownload();
				onClose();
			});
			actionsEl.appendChild(downloadBtn);
			// Delay focus so the button is in the DOM and focusable
			requestAnimationFrame(() => downloadBtn.focus());
		}

		dialog.appendChild(titleEl);
		dialog.appendChild(bodyEl);
		dialog.appendChild(actionsEl);
		overlay.appendChild(dialog);
		container.appendChild(overlay);

		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") dismiss();
		}
		document.addEventListener("keydown", handleKey);
	}

	// --- Welcome screen ---

	function createWelcomeEl(): HTMLDivElement {
		const el = document.createElement("div");
		el.className = "bpmn-welcome";
		el.dataset.theme = theme;
		el.style.display = "none";

		const inner = document.createElement("div");
		inner.className = "bpmn-welcome-inner";

		const iconEl = document.createElement("div");
		iconEl.className = "bpmn-welcome-icon";
		iconEl.innerHTML =
			'<svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
			'<circle cx="8" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="2"/>' +
			'<rect x="22" y="8" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>' +
			'<circle cx="56" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="3"/>' +
			'<line x1="15" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="2"/>' +
			'<line x1="42" y1="16" x2="49" y2="16" stroke="currentColor" stroke-width="2"/>' +
			"</svg>";
		inner.appendChild(iconEl);

		const title = document.createElement("h2");
		title.className = "bpmn-welcome-title";
		title.textContent = "BPMN Editor";
		inner.appendChild(title);

		const sub = document.createElement("p");
		sub.className = "bpmn-welcome-sub";
		sub.textContent = "Open a diagram or start fresh to get going.";
		inner.appendChild(sub);

		const actions = document.createElement("div");
		actions.className = "bpmn-welcome-actions";

		const newBtn = document.createElement("button");
		newBtn.type = "button";
		newBtn.className = "bpmn-welcome-btn primary";
		newBtn.textContent = "New diagram";
		newBtn.addEventListener("click", () => options.onNewDiagram?.());

		const importBtn = document.createElement("button");
		importBtn.type = "button";
		importBtn.className = "bpmn-welcome-btn secondary";
		importBtn.textContent = "Import files…";
		importBtn.addEventListener("click", () => options.onImportFiles?.());

		actions.appendChild(newBtn);
		actions.appendChild(importBtn);
		inner.appendChild(actions);

		if (options.examples && options.examples.length > 0) {
			const divider = document.createElement("div");
			divider.className = "bpmn-welcome-divider";
			inner.appendChild(divider);

			const examplesLabel = document.createElement("div");
			examplesLabel.className = "bpmn-welcome-examples-label";
			examplesLabel.textContent = "Examples";
			inner.appendChild(examplesLabel);

			const list = document.createElement("div");
			list.className = "bpmn-welcome-examples";
			for (const example of options.examples) {
				const item = document.createElement("button");
				item.type = "button";
				item.className = "bpmn-welcome-example";
				item.addEventListener("click", () => example.onOpen());

				if (example.badge) {
					const badge = document.createElement("span");
					badge.className = `bpmn-welcome-example-badge ${example.badge.toLowerCase()}`;
					badge.textContent = example.badge;
					item.appendChild(badge);
				}

				const text = document.createElement("span");
				text.className = "bpmn-welcome-example-text";

				const labelEl = document.createElement("span");
				labelEl.className = "bpmn-welcome-example-label";
				labelEl.textContent = example.label;
				text.appendChild(labelEl);

				if (example.description) {
					const descEl = document.createElement("span");
					descEl.className = "bpmn-welcome-example-desc";
					descEl.textContent = example.description;
					text.appendChild(descEl);
				}

				item.appendChild(text);

				const arrow = document.createElement("span");
				arrow.className = "bpmn-welcome-example-arrow";
				arrow.innerHTML =
					'<svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 7,6 1,11"/></svg>';
				item.appendChild(arrow);

				list.appendChild(item);
			}
			inner.appendChild(list);
		}

		el.appendChild(inner);
		return el;
	}

	function showWelcomeScreen(): void {
		if (welcomeEl) welcomeEl.style.display = "";
		// Defer so the callback runs after all synchronous plugin/HUD initialization
		// completes. On initial install the HUD elements don't exist yet; rAF fires
		// after the current JS task, by which time initEditorHud() has run.
		requestAnimationFrame(() => options.onWelcomeShow?.());
	}

	function hideWelcomeScreen(): void {
		if (welcomeEl) welcomeEl.style.display = "none";
	}

	// --- Group dropdown ---

	function closeDropdownEl(): void {
		if (dropdownEl) dropdownEl.classList.remove("open");
		openDropdownType = null;
	}

	function openDropdown(type: TabConfig["type"], group: TabState[], anchorEl: HTMLElement): void {
		if (!dropdownEl) return;
		dropdownEl.innerHTML = "";
		dropdownEl.dataset.theme = theme;

		for (const tab of group) {
			const item = document.createElement("div");
			item.className = "bpmn-tab-drop-item";
			if (tab.id === groupActiveId.get(type)) item.classList.add("active");

			const nameSpan = document.createElement("span");
			nameSpan.className = "bpmn-tab-drop-name";
			nameSpan.textContent = tab.config.name ?? tab.id;
			item.appendChild(nameSpan);

			const closeBtn = document.createElement("span");
			closeBtn.className = "bpmn-tab-close";
			closeBtn.textContent = "×";
			closeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				closeDropdownEl();
				requestClose(tab);
			});
			item.appendChild(closeBtn);

			item.addEventListener("click", () => {
				groupActiveId.set(type, tab.id);
				api.setActiveTab(tab.id);
				closeDropdownEl();
			});

			dropdownEl.appendChild(item);
		}

		const rect = anchorEl.getBoundingClientRect();
		dropdownEl.style.top = `${rect.bottom}px`;
		dropdownEl.style.left = `${rect.left}px`;
		dropdownEl.classList.add("open");
		openDropdownType = type;
	}

	function toggleDropdown(type: TabConfig["type"], group: TabState[], anchorEl: HTMLElement): void {
		if (openDropdownType === type) {
			closeDropdownEl();
		} else {
			openDropdown(type, group, anchorEl);
		}
	}

	// --- Tab bar rendering ---

	function requestClose(tab: TabState): void {
		if (hasContent(tab.config) && canvasApi) {
			const tabName = tab.config.name ?? `${tab.config.type} tab`;
			const onDownload = options.onDownloadTab ? () => options.onDownloadTab?.(tab.config) : null;
			showCloseDialog(canvasApi.container, tabName, onDownload, () => api.closeTab(tab.id));
		} else {
			api.closeTab(tab.id);
		}
	}

	/**
	 * Rebuilds the tab bar from scratch.
	 * At most three group tabs are rendered (one per type: BPMN, DMN, Form).
	 */
	function renderTabBar(): void {
		if (!tabBar) return;
		tabBar.innerHTML = "";

		for (const type of GROUP_TYPES) {
			const group = tabs.filter((t) => t.config.type === type);
			if (group.length === 0) continue;

			// Ensure groupActiveId[type] points to a valid tab in this group
			if (!group.some((t) => t.id === groupActiveId.get(type))) {
				const first = group[0];
				if (first) groupActiveId.set(type, first.id);
			}

			const isGroupActive = group.some((t) => t.id === activeId);
			createGroupTabEl(type, group, isGroupActive);
		}
	}

	function createGroupTabEl(
		type: TabConfig["type"],
		group: TabState[],
		isGroupActive: boolean,
	): void {
		const el = document.createElement("div");
		el.className = `bpmn-tab${isGroupActive ? " active" : ""}`;

		// Type badge
		const typeBadge = document.createElement("span");
		typeBadge.className = `bpmn-tab-type ${type}`;
		typeBadge.textContent = type.toUpperCase();
		el.appendChild(typeBadge);

		// Active file name within this group
		const activeTabId = groupActiveId.get(type);
		const activeTab = group.find((t) => t.id === activeTabId) ?? group[0];
		const nameEl = document.createElement("span");
		nameEl.className = "bpmn-tab-name";
		nameEl.textContent = activeTab?.config.name ?? type;
		el.appendChild(nameEl);

		// Warn indicator — shown if the group's active tab has a warning
		if (activeTab?.hasWarning) {
			const warnEl = document.createElement("span");
			warnEl.className = "bpmn-tab-warn";
			warnEl.textContent = "⚠";
			warnEl.title = "Referenced file not found in registry";
			el.appendChild(warnEl);
		}

		if (group.length > 1) {
			// Chevron — opens the group dropdown listing all files of this type
			const chevron = document.createElement("span");
			chevron.className = "bpmn-tab-chevron";
			chevron.innerHTML =
				'<svg viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>';
			el.appendChild(chevron);
		} else {
			// Close button — only when the group has a single file
			const tab = group[0];
			if (tab) {
				const closeBtn = document.createElement("span");
				closeBtn.className = "bpmn-tab-close";
				closeBtn.textContent = "×";
				closeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					requestClose(tab);
				});
				el.appendChild(closeBtn);
			}
		}

		el.addEventListener("click", () => {
			// Toggle dropdown first (while el is still in the DOM for correct positioning)
			if (group.length > 1) {
				toggleDropdown(type, group, el);
			}
			// Activate the group's last-selected file
			const id = groupActiveId.get(type);
			if (id) api.setActiveTab(id);
		});

		tabBar?.appendChild(el);
	}

	// --- Tab content mounting ---

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
		}
		// BPMN pane is intentionally empty and transparent — the main canvas SVG
		// shows through. pointer-events are set to none in setActiveTab.
	}

	function applyThemeToTab(tab: TabState): void {
		tab.dmnViewer?.setTheme(theme);
		tab.formViewer?.setTheme(theme);
	}

	function showWarning(tab: TabState, show: boolean): void {
		tab.hasWarning = show;
		renderTabBar();
	}

	// --- Public API ---

	const api: TabsApi = {
		openTab(config: TabConfig): string {
			const id = `tab_${++_tabCounter}`;
			const tab: TabState = {
				id,
				config,
				pane: null as unknown as HTMLDivElement,
				hasWarning: false,
			};
			tabs.push(tab);
			groupActiveId.set(config.type, id);
			hideWelcomeScreen();

			if (contentArea) mountTabContent(tab);

			renderTabBar();
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

			if (activeId === id) {
				const next = tabs[idx] ?? tabs[idx - 1];
				activeId = null;
				if (next) {
					api.setActiveTab(next.id);
				} else {
					// All tabs closed — restore pointer-events and show welcome screen
					if (contentArea) contentArea.style.pointerEvents = "";
					showWelcomeScreen();
				}
			}

			renderTabBar();
		},

		setActiveTab(id: string): void {
			const tab = tabs.find((t) => t.id === id);
			if (!tab) return;

			// Deactivate current
			if (activeId) {
				const prev = tabs.find((t) => t.id === activeId);
				if (prev) prev.pane.classList.add("hidden");
			}

			// Activate new
			activeId = id;
			tab.pane.classList.remove("hidden");
			groupActiveId.set(tab.config.type, id);

			// BPMN panes are transparent; disable pointer-events so the canvas is interactive
			if (contentArea) {
				contentArea.style.pointerEvents = tab.config.type === "bpmn" ? "none" : "";
			}

			renderTabBar();
			options.onTabActivate?.(id, tab.config);
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

			// Detect theme from canvas (canvas sets data-theme="dark" for dark, removes it for light)
			const container = cApi.container;
			theme = container.dataset.theme === "dark" ? "dark" : "light";

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

			// Create welcome screen (shown until the first tab opens)
			welcomeEl = createWelcomeEl();
			contentArea.appendChild(welcomeEl);
			showWelcomeScreen();

			// Create body-level dropdown for groups with multiple files
			dropdownEl = document.createElement("div");
			dropdownEl.className = "bpmn-tab-dropdown";
			dropdownEl.dataset.theme = theme;
			document.body.appendChild(dropdownEl);

			// Close dropdown when clicking outside the tab bar or dropdown
			outsideClickHandler = (e: PointerEvent) => {
				if (
					dropdownEl &&
					!dropdownEl.contains(e.target as Node) &&
					!tabBar?.contains(e.target as Node)
				) {
					closeDropdownEl();
				}
			};
			document.addEventListener("pointerdown", outsideClickHandler);

			// Listen for theme changes (canvas toggles data-theme="dark"; absence means light)
			const observer = new MutationObserver(() => {
				const t = container.dataset.theme;
				theme = t === "dark" ? "dark" : "light";
				if (tabBar) tabBar.dataset.theme = theme;
				if (welcomeEl) welcomeEl.dataset.theme = theme;
				if (dropdownEl) dropdownEl.dataset.theme = theme;
				for (const tab of tabs) applyThemeToTab(tab);
			});
			observer.observe(container, { attributes: true, attributeFilter: ["data-theme"] });
		},

		uninstall(): void {
			if (outsideClickHandler) {
				document.removeEventListener("pointerdown", outsideClickHandler);
				outsideClickHandler = null;
			}
			dropdownEl?.remove();
			dropdownEl = null;
			welcomeEl?.remove();
			welcomeEl = null;
			for (const tab of tabs) {
				tab.dmnViewer?.destroy();
				tab.formViewer?.destroy();
			}
			tabs.length = 0;
			activeId = null;
			groupActiveId.clear();
			openDropdownType = null;
			tabBar?.remove();
			contentArea?.remove();
			tabBar = null;
			contentArea = null;
			canvasApi = null;
		},
	};
}
