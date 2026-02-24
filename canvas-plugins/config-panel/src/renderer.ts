import type { RenderedShape, ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import type { FieldSchema, FieldValue, GroupSchema, PanelAdapter, PanelSchema } from "./types.js";

interface Registration {
	schema: PanelSchema;
	adapter: PanelAdapter;
}

type Bounds = { x: number; y: number; width: number; height: number };

export class ConfigPanelRenderer {
	private readonly _schemas: Map<string, Registration>;
	private readonly _getDefinitions: () => BpmnDefinitions | null;
	private readonly _applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void;
	private readonly _getViewport: () => ViewportState;
	private readonly _setViewport: (state: ViewportState) => void;

	private _compactEl: HTMLElement | null = null;
	private _overlayEl: HTMLElement | null = null;
	private _selectedId: string | null = null;
	private _selectedType: string | null = null;
	private _selectedBounds: Bounds | null = null;
	private _elementName = "";
	private _fullOpen = false;
	private _activeTabId: string | null = null;
	private _values: Record<string, FieldValue> = {};

	constructor(
		schemas: Map<string, Registration>,
		getDefinitions: () => BpmnDefinitions | null,
		applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void,
		getViewport: () => ViewportState,
		setViewport: (state: ViewportState) => void,
	) {
		this._schemas = schemas;
		this._getDefinitions = getDefinitions;
		this._applyChange = applyChange;
		this._getViewport = getViewport;
		this._setViewport = setViewport;
	}

	onSelect(ids: string[], shapes: RenderedShape[]): void {
		if (ids.length !== 1) {
			this._close();
			return;
		}
		const id = ids[0];
		if (!id) {
			this._close();
			return;
		}
		const shape = shapes.find((s) => s.id === id);
		const elementType = shape?.flowElement?.type;
		if (!elementType) {
			this._close();
			return;
		}
		const reg = this._schemas.get(elementType);
		if (!reg) {
			this._close();
			return;
		}

		this._selectedId = id;
		this._selectedType = elementType;
		this._selectedBounds = shape?.shape?.bounds ?? null;
		this._elementName = shape?.flowElement?.name ?? "";
		this._refreshValues(reg);

		if (this._fullOpen) {
			this._showFull(reg);
		} else {
			this._showCompact(reg);
		}
	}

	onDiagramChange(defs: BpmnDefinitions): void {
		if (!this._selectedId || !this._selectedType) return;
		const reg = this._schemas.get(this._selectedType);
		if (!reg) return;
		this._values = reg.adapter.read(defs, this._selectedId);
		this._refreshInputs();
		if (this._fullOpen) {
			this._refreshGroupVisibility(reg.schema.groups);
		}
	}

	destroy(): void {
		this._close();
	}

	private _refreshValues(reg: Registration): void {
		const defs = this._getDefinitions();
		if (!defs || !this._selectedId) return;
		this._values = reg.adapter.read(defs, this._selectedId);
	}

	private _applyField(key: string, value: FieldValue): void {
		const id = this._selectedId;
		const type = this._selectedType;
		if (!id || !type) return;
		const reg = this._schemas.get(type);
		if (!reg) return;
		this._values[key] = value;
		const snapshot = { ...this._values };
		this._applyChange((defs) => reg.adapter.write(defs, id, snapshot));
	}

	private _centerSelected(targetScreenX: number, targetScreenY: number): void {
		const bounds = this._selectedBounds;
		if (!bounds) return;
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		const { scale } = this._getViewport();
		this._setViewport({ tx: targetScreenX - cx * scale, ty: targetScreenY - cy * scale, scale });
	}

	private _close(): void {
		this._hideCompact();
		this._hideOverlay();
		this._selectedId = null;
		this._selectedType = null;
		this._selectedBounds = null;
		this._elementName = "";
		this._fullOpen = false;
		this._activeTabId = null;
		this._values = {};
	}

	private _hideCompact(): void {
		this._compactEl?.remove();
		this._compactEl = null;
	}

	private _hideOverlay(): void {
		this._overlayEl?.remove();
		this._overlayEl = null;
	}

	/** Update all input values in-place without re-rendering (preserves focus). */
	private _refreshInputs(): void {
		const container = this._fullOpen ? this._overlayEl : this._compactEl;
		if (!container) return;
		for (const [key, value] of Object.entries(this._values)) {
			const els = container.querySelectorAll<
				HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
			>(`[data-field-key="${key}"]`);
			for (const el of els) {
				if (document.activeElement === el) continue;
				if (el instanceof HTMLInputElement && el.type === "checkbox") {
					el.checked = value === true || value === "true";
				} else {
					el.value = typeof value === "string" ? value : "";
				}
			}
		}
	}

	/** Show/hide tabs and groups based on their conditions. */
	private _refreshGroupVisibility(groups: GroupSchema[]): void {
		const overlay = this._overlayEl;
		if (!overlay) return;

		let activeIsVisible = false;
		for (const group of groups) {
			const isVisible = !group.condition || group.condition(this._values);
			const tabBtn = overlay.querySelector<HTMLElement>(`[data-tab-id="${group.id}"]`);
			if (tabBtn) tabBtn.style.display = isVisible ? "" : "none";
			if (group.id === this._activeTabId && isVisible) activeIsVisible = true;
		}

		// If the active tab just became hidden, switch to the first visible one
		if (!activeIsVisible) {
			for (const group of groups) {
				if (!group.condition || group.condition(this._values)) {
					this._activateTab(overlay, group.id);
					break;
				}
			}
		}
	}

	private _activateTab(overlay: HTMLElement, groupId: string): void {
		this._activeTabId = groupId;
		for (const btn of overlay.querySelectorAll<HTMLElement>(".bpmn-cfg-tab-btn")) {
			btn.classList.remove("active");
		}
		for (const grp of overlay.querySelectorAll<HTMLElement>(".bpmn-cfg-group")) {
			grp.style.display = "none";
		}
		const tabBtn = overlay.querySelector<HTMLElement>(`[data-tab-id="${groupId}"]`);
		const groupEl = overlay.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
		tabBtn?.classList.add("active");
		if (groupEl) groupEl.style.display = "";
	}

	// ── Compact panel ─────────────────────────────────────────────────────────

	private _showCompact(reg: Registration): void {
		this._hideCompact();

		const el = document.createElement("div");
		el.className = "bpmn-cfg-compact";

		// Header
		const header = document.createElement("div");
		header.className = "bpmn-cfg-compact-header";

		const title = document.createElement("span");
		title.className = "bpmn-cfg-compact-title";
		title.textContent = this._elementName || (this._selectedType ?? "");
		title.title = title.textContent;

		const closeBtn = document.createElement("button");
		closeBtn.className = "bpmn-cfg-compact-close";
		closeBtn.setAttribute("title", "Close");
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", () => this._close());

		header.appendChild(title);
		header.appendChild(closeBtn);

		// Body: compact fields
		const body = document.createElement("div");
		body.className = "bpmn-cfg-compact-body";

		for (const field of reg.schema.compact) {
			body.appendChild(this._renderField(field));
		}

		// Configure button (if full groups exist)
		if (reg.schema.groups.length > 0) {
			const cfgBtn = document.createElement("button");
			cfgBtn.className = "bpmn-cfg-configure-btn";
			cfgBtn.textContent = "Configure →";
			cfgBtn.addEventListener("click", () => {
				this._fullOpen = true;
				this._hideCompact();
				this._showFull(reg);
			});
			body.appendChild(cfgBtn);
		}

		el.appendChild(header);
		el.appendChild(body);
		document.body.appendChild(el);
		this._compactEl = el;
	}

	// ── Full overlay ──────────────────────────────────────────────────────────

	private _showFull(reg: Registration): void {
		this._hideOverlay();

		// Center the selected element in the left 35% darkened area
		this._centerSelected(window.innerWidth * 0.175, window.innerHeight / 2);

		const overlay = document.createElement("div");
		overlay.className = "bpmn-cfg-overlay";

		const closeAndRestore = () => {
			this._fullOpen = false;
			this._hideOverlay();
			this._centerSelected(window.innerWidth / 2, window.innerHeight / 2);
			this._showCompact(reg);
		};

		const backdrop = document.createElement("div");
		backdrop.className = "bpmn-cfg-backdrop";
		backdrop.title = "Close panel";
		backdrop.addEventListener("click", closeAndRestore);

		const panel = document.createElement("div");
		panel.className = "bpmn-cfg-full";

		// Header
		const header = document.createElement("div");
		header.className = "bpmn-cfg-full-header";

		const info = document.createElement("div");
		info.className = "bpmn-cfg-full-info";

		const typeLabel = document.createElement("div");
		typeLabel.className = "bpmn-cfg-full-type";
		typeLabel.textContent = this._selectedType ?? "";

		const nameLabel = document.createElement("div");
		nameLabel.className = "bpmn-cfg-full-name";
		nameLabel.textContent = this._elementName || "(unnamed)";

		info.appendChild(typeLabel);
		info.appendChild(nameLabel);

		const closeBtn = document.createElement("button");
		closeBtn.className = "bpmn-cfg-full-close";
		closeBtn.setAttribute("title", "Close");
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", closeAndRestore);

		header.appendChild(info);
		header.appendChild(closeBtn);

		// Tabs bar
		const tabs = document.createElement("div");
		tabs.className = "bpmn-cfg-tabs";

		// Scrollable body
		const body = document.createElement("div");
		body.className = "bpmn-cfg-full-body";

		// Ensure the active tab is valid for the current values
		const hasActive = reg.schema.groups.some(
			(g) =>
				g.id === this._activeTabId &&
				g.fields.length > 0 &&
				(!g.condition || g.condition(this._values)),
		);
		if (!hasActive) {
			this._activeTabId =
				reg.schema.groups.find(
					(g) => g.fields.length > 0 && (!g.condition || g.condition(this._values)),
				)?.id ?? null;
		}

		for (const group of reg.schema.groups) {
			if (group.fields.length === 0) continue;

			const isVisible = !group.condition || group.condition(this._values);
			const isActive = group.id === this._activeTabId;

			// Tab button
			const tabBtn = document.createElement("button");
			tabBtn.className = "bpmn-cfg-tab-btn";
			tabBtn.textContent = group.label;
			tabBtn.setAttribute("data-tab-id", group.id);
			if (!isVisible) tabBtn.style.display = "none";
			if (isActive) tabBtn.classList.add("active");
			tabs.appendChild(tabBtn);

			// Group content (visible only when this tab is active)
			const groupEl = document.createElement("div");
			groupEl.className = "bpmn-cfg-group";
			groupEl.setAttribute("data-group-id", group.id);
			if (!isActive) groupEl.style.display = "none";

			for (const field of group.fields) {
				groupEl.appendChild(this._renderField(field));
			}
			body.appendChild(groupEl);

			tabBtn.addEventListener("click", () => {
				this._activateTab(overlay, group.id);
			});
		}

		panel.appendChild(header);
		panel.appendChild(tabs);
		panel.appendChild(body);

		overlay.appendChild(backdrop);
		overlay.appendChild(panel);
		document.body.appendChild(overlay);
		this._overlayEl = overlay;
	}

	// ── Field rendering ───────────────────────────────────────────────────────

	private _renderField(field: FieldSchema): HTMLElement {
		const wrapper = document.createElement("div");
		wrapper.className = "bpmn-cfg-field";

		const value = this._values[field.key];

		if (field.type === "toggle") {
			wrapper.appendChild(this._renderToggle(field, value));
		} else {
			const labelRow = document.createElement("div");
			labelRow.className = "bpmn-cfg-field-label";
			labelRow.textContent = field.label;

			if (field.docsUrl) {
				const link = document.createElement("a");
				link.className = "bpmn-cfg-field-docs";
				link.textContent = "docs";
				link.href = field.docsUrl;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				labelRow.appendChild(link);
			}
			wrapper.appendChild(labelRow);

			if (field.type === "select") {
				wrapper.appendChild(this._renderSelect(field, value));
			} else if (field.type === "textarea") {
				wrapper.appendChild(this._renderTextarea(field, value));
			} else {
				wrapper.appendChild(this._renderTextInput(field, value));
			}
		}

		if (field.hint) {
			const hint = document.createElement("div");
			hint.className = "bpmn-cfg-field-hint";
			hint.textContent = field.hint;
			wrapper.appendChild(hint);
		}

		return wrapper;
	}

	private _renderTextInput(field: FieldSchema, value: FieldValue): HTMLInputElement {
		const input = document.createElement("input");
		input.type = field.secret === true ? "password" : "text";
		input.className = "bpmn-cfg-input";
		input.placeholder = field.placeholder ?? "";
		input.value = typeof value === "string" ? value : "";
		input.setAttribute("data-field-key", field.key);
		input.addEventListener("change", () => this._applyField(field.key, input.value));
		return input;
	}

	private _renderTextarea(field: FieldSchema, value: FieldValue): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "bpmn-cfg-textarea";
		ta.placeholder = field.placeholder ?? "";
		ta.value = typeof value === "string" ? value : "";
		ta.setAttribute("data-field-key", field.key);
		ta.addEventListener("change", () => this._applyField(field.key, ta.value));
		return ta;
	}

	private _renderSelect(field: FieldSchema, value: FieldValue): HTMLSelectElement {
		const sel = document.createElement("select");
		sel.className = "bpmn-cfg-select";
		sel.setAttribute("data-field-key", field.key);
		for (const opt of field.options ?? []) {
			const option = document.createElement("option");
			option.value = opt.value;
			option.textContent = opt.label;
			sel.appendChild(option);
		}
		sel.value = typeof value === "string" ? value : (field.options?.[0]?.value ?? "");
		sel.addEventListener("change", () => this._applyField(field.key, sel.value));
		return sel;
	}

	private _renderToggle(field: FieldSchema, value: FieldValue): HTMLElement {
		const row = document.createElement("div");
		row.className = "bpmn-cfg-toggle-row";

		const lbl = document.createElement("label");
		lbl.className = "bpmn-cfg-toggle";

		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = value === true || value === "true";
		input.setAttribute("data-field-key", field.key);

		const track = document.createElement("span");
		track.className = "bpmn-cfg-toggle-track";

		const thumb = document.createElement("span");
		thumb.className = "bpmn-cfg-toggle-thumb";

		lbl.appendChild(input);
		lbl.appendChild(track);
		lbl.appendChild(thumb);

		const labelText = document.createElement("span");
		labelText.className = "bpmn-cfg-toggle-label";
		labelText.textContent = field.label;

		input.addEventListener("change", () => this._applyField(field.key, input.checked));

		row.appendChild(lbl);
		row.appendChild(labelText);
		return row;
	}
}
