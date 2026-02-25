/**
 * @bpmn-sdk/canvas-plugin-main-menu — main menu plugin for `@bpmn-sdk/canvas`.
 *
 * Adds a panel in the top-right corner of the canvas with an optional title
 * and a menu button. The menu lets users switch between light, dark, and
 * automatic (OS-preference) color themes.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmn-sdk/canvas";
 * import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   xml: myBpmnXml,
 *   plugins: [createMainMenuPlugin({ title: "My App" })],
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin, Theme } from "@bpmn-sdk/canvas";
import { injectMainMenuStyles } from "./css.js";

export { MAIN_MENU_CSS, MAIN_MENU_STYLE_ID, injectMainMenuStyles } from "./css.js";

export interface MainMenuOptions {
	/** Optional title text shown to the left of the menu button. */
	title?: string;
}

const DOTS_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>';

const CHECK_ICON =
	'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,6 4.5,9 10.5,3"/></svg>';

const MOON_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13 9.5a6 6 0 1 1-7.5-7.5 7 7 0 0 0 7.5 7.5z"/></svg>';

const SUN_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.8"/><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/><line x1="3.3" y1="3.3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="12.7" y2="12.7"/><line x1="3.3" y1="12.7" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="12.7" y2="3.3"/></svg>';

const AUTO_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 8V3.5"/><path d="M8 8l3.2 2"/></svg>';

const THEMES: Array<{ value: Theme; label: string; icon: string }> = [
	{ value: "dark", label: "Dark", icon: MOON_ICON },
	{ value: "light", label: "Light", icon: SUN_ICON },
	{ value: "auto", label: "System", icon: AUTO_ICON },
];

/**
 * Creates a main menu plugin instance.
 *
 * Each call returns a fresh plugin — pass one instance per canvas.
 */
export function createMainMenuPlugin(options: MainMenuOptions = {}): CanvasPlugin {
	let panelEl: HTMLDivElement | null = null;
	let dropdownEl: HTMLDivElement | null = null;
	let isOpen = false;
	const offPointerDown = { fn: (_e: PointerEvent) => {} };

	return {
		name: "main-menu",

		install(api) {
			injectMainMenuStyles();

			let currentTheme = api.getTheme();

			// ── Panel (button container) ───────────────────────────────────
			const panel = document.createElement("div");
			panel.className = "bpmn-main-menu-panel";

			if (options.title) {
				const title = document.createElement("span");
				title.className = "bpmn-main-menu-title";
				title.textContent = options.title;
				panel.appendChild(title);

				const sep = document.createElement("div");
				sep.className = "bpmn-main-menu-sep";
				panel.appendChild(sep);
			}

			const menuBtn = document.createElement("button");
			menuBtn.className = "bpmn-menu-btn";
			menuBtn.type = "button";
			menuBtn.setAttribute("aria-label", "Main menu");
			menuBtn.title = "Main menu";
			menuBtn.innerHTML = DOTS_ICON;
			panel.appendChild(menuBtn);

			api.container.appendChild(panel);
			panelEl = panel;

			// ── Dropdown ──────────────────────────────────────────────────
			const dropdown = document.createElement("div");
			dropdown.className = "bpmn-menu-dropdown";

			const themeLabel = document.createElement("div");
			themeLabel.className = "bpmn-menu-drop-label";
			themeLabel.textContent = "Theme";
			dropdown.appendChild(themeLabel);

			function buildThemeItems(): void {
				// Remove existing theme items (keep the label)
				while (dropdown.children.length > 1) {
					dropdown.removeChild(dropdown.lastChild as Node);
				}
				for (const t of THEMES) {
					const btn = document.createElement("button");
					btn.className = "bpmn-menu-item";
					btn.type = "button";

					const checkSpan = document.createElement("span");
					checkSpan.className = "bpmn-menu-item-check";
					if (t.value === currentTheme) checkSpan.innerHTML = CHECK_ICON;

					const iconSpan = document.createElement("span");
					iconSpan.className = "bpmn-menu-item-icon";
					iconSpan.innerHTML = t.icon;

					const labelSpan = document.createElement("span");
					labelSpan.textContent = t.label;

					btn.appendChild(checkSpan);
					btn.appendChild(iconSpan);
					btn.appendChild(labelSpan);

					btn.addEventListener("click", () => {
						currentTheme = t.value;
						api.setTheme(t.value);
						buildThemeItems();
						closeDropdown();
					});
					dropdown.appendChild(btn);
				}
			}

			buildThemeItems();
			document.body.appendChild(dropdown);
			dropdownEl = dropdown;

			// ── Open / close logic ────────────────────────────────────────
			function openDropdown(): void {
				const rect = menuBtn.getBoundingClientRect();
				dropdown.style.top = `${rect.bottom + 6}px`;
				dropdown.style.right = `${window.innerWidth - rect.right}px`;
				dropdown.style.left = "auto";
				dropdown.classList.add("open");
				isOpen = true;
			}

			function closeDropdown(): void {
				dropdown.classList.remove("open");
				isOpen = false;
			}

			menuBtn.addEventListener("pointerdown", (e) => {
				e.stopPropagation();
			});
			menuBtn.addEventListener("click", () => {
				if (isOpen) {
					closeDropdown();
				} else {
					buildThemeItems();
					openDropdown();
				}
			});

			offPointerDown.fn = (e: PointerEvent) => {
				if (isOpen && !dropdown.contains(e.target as Node)) {
					closeDropdown();
				}
			};
			document.addEventListener("pointerdown", offPointerDown.fn);
		},

		uninstall() {
			document.removeEventListener("pointerdown", offPointerDown.fn);
			dropdownEl?.remove();
			dropdownEl = null;
			panelEl?.remove();
			panelEl = null;
			isOpen = false;
		},
	};
}
