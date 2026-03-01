import type { RenderedEdge, RenderedShape } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import type { FieldSchema, FieldValue, GroupSchema, PanelAdapter, PanelSchema } from "./types.js";

// Attribute set on the field wrapper div when the field has a condition, used
// by _refreshConditionals to toggle visibility without a full re-render.
const FIELD_WRAPPER_ATTR = "data-field-wrapper";

interface Registration {
	schema: PanelSchema;
	adapter: PanelAdapter;
}

export class ConfigPanelRenderer {
	private readonly _schemas: Map<string, Registration>;
	private readonly _getDefinitions: () => BpmnDefinitions | null;
	private readonly _applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void;

	private _panelEl: HTMLElement | null = null;
	private _collapsed = false;
	private _selectedId: string | null = null;
	private _selectedType: string | null = null;
	private _elementName = "";
	private _activeTabId: string | null = null;
	private _values: Record<string, FieldValue> = {};
	/** The effective registration after optional `resolve?` override. */
	private _effectiveReg: Registration | null = null;

	constructor(
		schemas: Map<string, Registration>,
		getDefinitions: () => BpmnDefinitions | null,
		applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void,
	) {
		this._schemas = schemas;
		this._getDefinitions = getDefinitions;
		this._applyChange = applyChange;
	}

	onSelect(ids: string[], shapes: RenderedShape[], edges: RenderedEdge[] = []): void {
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

		if (elementType) {
			// Shape selection
			const reg = this._schemas.get(elementType);
			if (!reg) {
				this._close();
				return;
			}

			this._selectedId = id;
			this._selectedType = elementType;
			this._elementName = shape?.flowElement?.name ?? "";

			// Resolve optional template override
			const defs = this._getDefinitions();
			const resolved = defs ? (reg.adapter.resolve?.(defs, id) ?? null) : null;
			this._effectiveReg = resolved ?? reg;

			this._refreshValues(this._effectiveReg);
			this._showPanel(this._effectiveReg);
		} else {
			// Edge selection — check if it's a sequence flow
			const isEdge = edges.some((e) => e.id === id);
			if (!isEdge) {
				this._close();
				return;
			}
			const defs = this._getDefinitions();
			const isSequenceFlow = defs?.processes.some((p) => p.sequenceFlows.some((f) => f.id === id));
			if (!isSequenceFlow) {
				this._close();
				return;
			}
			const reg = this._schemas.get("sequenceFlow");
			if (!reg) {
				this._close();
				return;
			}

			this._selectedId = id;
			this._selectedType = "sequenceFlow";
			const sf = defs?.processes.flatMap((p) => p.sequenceFlows).find((f) => f.id === id);
			this._elementName = sf?.name ?? "";
			this._effectiveReg = reg;

			this._refreshValues(reg);
			this._showPanel(reg);
		}
	}

	onDiagramChange(defs: BpmnDefinitions): void {
		if (!this._selectedId || !this._selectedType) return;
		const reg = this._schemas.get(this._selectedType);
		if (!reg) return;

		// Re-resolve in case a template was applied or removed
		const resolved = reg.adapter.resolve?.(defs, this._selectedId) ?? null;
		const newEffective = resolved ?? reg;

		this._values = newEffective.adapter.read(defs, this._selectedId);

		// If the effective registration changed (e.g. template applied), re-render
		if (newEffective !== this._effectiveReg) {
			this._effectiveReg = newEffective;
			this._showPanel(newEffective);
			return;
		}

		this._refreshInputs();
		this._refreshConditionals(newEffective.schema);
		this._refreshValidation(newEffective.schema);
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
		// Use the template-resolved adapter (if any) so template attributes are preserved on write
		const effective = this._effectiveReg ?? reg;
		this._values[key] = value;
		// Refresh visibility and validation immediately without waiting for diagram:change
		this._refreshConditionals(effective.schema);
		this._refreshValidation(effective.schema);
		const snapshot = { ...this._values };
		this._applyChange((defs) => effective.adapter.write(defs, id, snapshot));
	}

	private _close(): void {
		this._hidePanel();
		this._selectedId = null;
		this._selectedType = null;
		this._elementName = "";
		this._activeTabId = null;
		this._values = {};
		this._effectiveReg = null;
	}

	private _hidePanel(): void {
		this._panelEl?.remove();
		this._panelEl = null;
	}

	/** Update all input values in-place without re-rendering (preserves focus). */
	private _refreshInputs(): void {
		const container = this._panelEl;
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

	/**
	 * Refresh both field-level and group-level conditional visibility.
	 * Called synchronously after any value change so the UI updates immediately.
	 */
	private _refreshConditionals(schema: PanelSchema): void {
		const container = this._panelEl;
		if (!container) return;

		// Field-level conditions
		const allFields = schema.groups.flatMap((g) => g.fields);
		for (const field of allFields) {
			if (!field.condition) continue;
			const wrapper = container.querySelector<HTMLElement>(
				`[${FIELD_WRAPPER_ATTR}="${field.key}"]`,
			);
			if (wrapper) wrapper.style.display = field.condition(this._values) ? "" : "none";
		}

		this._refreshGroupVisibility(schema.groups);
	}

	/** Update red-border invalid state for required fields that are empty. */
	private _refreshValidation(schema: PanelSchema): void {
		const container = this._panelEl;
		if (!container) return;
		const allFields = schema.groups.flatMap((g) => g.fields);
		for (const field of allFields) {
			if (!field.required) continue;
			const wrapper = container.querySelector<HTMLElement>(
				`[${FIELD_WRAPPER_ATTR}="${field.key}"]`,
			);
			if (!wrapper) continue;
			const val = this._values[field.key];
			const isEmpty = val === "" || val === undefined;
			wrapper.classList.toggle("bpmn-cfg-field--invalid", isEmpty);
		}
	}

	/** Show/hide tabs and groups based on their conditions. */
	private _refreshGroupVisibility(groups: GroupSchema[]): void {
		const panel = this._panelEl;
		if (!panel) return;

		let activeIsVisible = false;
		for (const group of groups) {
			const isVisible = !group.condition || group.condition(this._values);
			const tabBtn = panel.querySelector<HTMLElement>(`[data-tab-id="${group.id}"]`);
			if (tabBtn) tabBtn.style.display = isVisible ? "" : "none";
			if (group.id === this._activeTabId && isVisible) activeIsVisible = true;
		}

		// If the active tab just became hidden, switch to the first visible one
		if (!activeIsVisible) {
			for (const group of groups) {
				if (!group.condition || group.condition(this._values)) {
					this._activateTab(panel, group.id);
					break;
				}
			}
		}
	}

	private _activateTab(panel: HTMLElement, groupId: string): void {
		this._activeTabId = groupId;
		for (const btn of panel.querySelectorAll<HTMLElement>(".bpmn-cfg-tab-btn")) {
			btn.classList.remove("active");
		}
		for (const grp of panel.querySelectorAll<HTMLElement>(".bpmn-cfg-group")) {
			grp.style.display = "none";
		}
		const tabBtn = panel.querySelector<HTMLElement>(`[data-tab-id="${groupId}"]`);
		const groupEl = panel.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
		tabBtn?.classList.add("active");
		if (groupEl) groupEl.style.display = "";
	}

	// ── Inspector panel ───────────────────────────────────────────────────────

	private _showPanel(reg: Registration): void {
		this._hidePanel();

		const panel = document.createElement("div");
		panel.className = "bpmn-cfg-full";
		if (this._collapsed) panel.classList.add("bpmn-cfg-full--collapsed");

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

		const collapseBtn = document.createElement("button");
		collapseBtn.className = "bpmn-cfg-collapse-btn";
		collapseBtn.setAttribute("title", this._collapsed ? "Expand" : "Collapse");
		collapseBtn.textContent = this._collapsed ? "›" : "‹";
		collapseBtn.addEventListener("click", () => {
			this._collapsed = !this._collapsed;
			panel.classList.toggle("bpmn-cfg-full--collapsed", this._collapsed);
			collapseBtn.textContent = this._collapsed ? "›" : "‹";
			collapseBtn.setAttribute("title", this._collapsed ? "Expand" : "Collapse");
		});

		const closeBtn = document.createElement("button");
		closeBtn.className = "bpmn-cfg-full-close";
		closeBtn.setAttribute("title", "Close");
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", () => this._close());

		header.appendChild(info);
		header.appendChild(collapseBtn);
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
				this._activateTab(panel, group.id);
			});
		}

		panel.appendChild(header);
		panel.appendChild(tabs);
		panel.appendChild(body);
		document.body.appendChild(panel);
		this._panelEl = panel;
	}

	// ── Field rendering ───────────────────────────────────────────────────────

	private _renderField(field: FieldSchema): HTMLElement {
		const wrapper = document.createElement("div");
		wrapper.className = "bpmn-cfg-field";

		// Always stamp the key so _refreshConditionals and _refreshValidation can find the wrapper
		wrapper.setAttribute(FIELD_WRAPPER_ATTR, field.key);
		if (field.condition && !field.condition(this._values)) wrapper.style.display = "none";

		const value = this._values[field.key];

		// Initial required-empty state
		if (field.required && (value === "" || value === undefined)) {
			wrapper.classList.add("bpmn-cfg-field--invalid");
		}

		if (field.type === "action") {
			wrapper.appendChild(this._renderActionButton(field));
		} else if (field.type === "toggle") {
			wrapper.appendChild(this._renderToggle(field, value));
		} else {
			const labelRow = document.createElement("div");
			labelRow.className = "bpmn-cfg-field-label";
			labelRow.textContent = field.label;

			if (field.required) {
				const star = document.createElement("span");
				star.className = "bpmn-cfg-required-star";
				star.textContent = "*";
				star.setAttribute("aria-hidden", "true");
				labelRow.appendChild(star);
			}

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
			} else if (field.type === "feel-expression") {
				wrapper.appendChild(this._renderFeelExpression(field, value));
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

	private _renderFeelExpression(field: FieldSchema, value: FieldValue): HTMLElement {
		const text = typeof value === "string" ? value : "";

		const wrap = document.createElement("div");
		wrap.className = "bpmn-cfg-feel-wrap";

		const ta = document.createElement("textarea");
		ta.className = "bpmn-cfg-feel-ta bpmn-cfg-textarea";
		ta.placeholder = field.placeholder ?? "";
		ta.value = text;
		ta.setAttribute("data-field-key", field.key);
		ta.setAttribute("spellcheck", "false");
		ta.addEventListener("change", () => this._applyField(field.key, ta.value));
		wrap.appendChild(ta);

		if (field.openInPlayground) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "bpmn-cfg-feel-playground-btn";
			btn.textContent = "Open in FEEL Playground ↗";
			btn.addEventListener("click", () => field.openInPlayground?.(this._values));
			wrap.appendChild(btn);
		}

		return wrap;
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

	private _renderActionButton(field: FieldSchema): HTMLElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "bpmn-cfg-action-btn";
		btn.textContent = field.label;
		btn.addEventListener("click", () =>
			field.onClick?.(this._values, (k, v) => this._applyField(k, v)),
		);
		return btn;
	}
}
