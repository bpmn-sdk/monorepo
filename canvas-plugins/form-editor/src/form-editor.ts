import { Form } from "@bpmn-sdk/core";
import type {
	FormComponent,
	FormDefinition,
	FormGroupComponent,
	FormValueOption,
} from "@bpmn-sdk/core";
import { injectFormEditorStyles } from "./css.js";

export interface FormEditorOptions {
	container: HTMLElement;
	theme?: "dark" | "light";
}

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

/** Component types that have a label + key (field components). */
const FIELD_TYPES = new Set([
	"textfield",
	"textarea",
	"number",
	"select",
	"radio",
	"checkbox",
	"checklist",
	"taglist",
	"filepicker",
	"datetime",
	"expression",
	"table",
]);

/** Component types with an option list (label+value pairs). */
const OPTION_TYPES = new Set(["select", "radio", "checklist", "taglist"]);

/** Component types that contain child components. */
const CONTAINER_TYPES = new Set(["group", "dynamiclist"]);

/** Display label for each type shown in the "Add" dropdown. */
const TYPE_LABELS: Record<string, string> = {
	textfield: "Text Field",
	textarea: "Text Area",
	number: "Number",
	select: "Select",
	radio: "Radio",
	checkbox: "Checkbox",
	checklist: "Checklist",
	taglist: "Tag List",
	filepicker: "File Picker",
	datetime: "Date/Time",
	expression: "Expression",
	table: "Table",
	text: "Text (Markdown)",
	html: "HTML",
	image: "Image",
	button: "Button",
	separator: "Separator",
	spacer: "Spacer",
	iframe: "iFrame",
	group: "Group",
	dynamiclist: "Dynamic List",
};

const ADD_GROUPS: Array<{ label: string; types: string[] }> = [
	{
		label: "Fields",
		types: [
			"textfield",
			"textarea",
			"number",
			"select",
			"radio",
			"checkbox",
			"checklist",
			"taglist",
			"filepicker",
			"datetime",
		],
	},
	{
		label: "Display",
		types: ["text", "html", "image", "button", "separator", "spacer"],
	},
	{
		label: "Advanced",
		types: ["expression", "table", "iframe"],
	},
	{
		label: "Layout",
		types: ["group", "dynamiclist"],
	},
];

function makeDefaultComponent(type: string): FormComponent {
	const id = uid();
	if (type === "textfield" || type === "textarea" || type === "number") {
		return { id, type, label: "Label", key: `field_${id}` } as FormComponent;
	}
	if (type === "select" || type === "radio") {
		return { id, type, label: "Label", key: `field_${id}`, values: [] } as FormComponent;
	}
	if (type === "checkbox") {
		return { id, type, label: "Label", key: `field_${id}` } as FormComponent;
	}
	if (type === "checklist" || type === "taglist") {
		return { id, type, label: "Label", key: `field_${id}`, values: [] } as FormComponent;
	}
	if (type === "filepicker") {
		return { id, type, label: "File", key: `field_${id}` } as FormComponent;
	}
	if (type === "datetime") {
		return { id, type, key: `field_${id}` } as FormComponent;
	}
	if (type === "button") {
		return { id, type, label: "Submit", action: "submit" } as FormComponent;
	}
	if (type === "text") {
		return { id, type, text: "Text content" } as FormComponent;
	}
	if (type === "html") {
		return { id, type, content: "<p>HTML content</p>" } as FormComponent;
	}
	if (type === "image") {
		return { id, type, source: "" } as FormComponent;
	}
	if (type === "separator" || type === "spacer") {
		return { id, type } as FormComponent;
	}
	if (type === "iframe") {
		return { id, type, url: "", height: 200 } as FormComponent;
	}
	if (type === "expression") {
		return { id, type, key: `expr_${id}`, expression: "" } as FormComponent;
	}
	if (type === "table") {
		return { id, type, label: "Table" } as FormComponent;
	}
	if (type === "group") {
		return { id, type, label: "Group", components: [] } as FormComponent;
	}
	if (type === "dynamiclist") {
		return { id, type, label: "List", components: [], path: `list_${id}` } as FormComponent;
	}
	return { id, type } as FormComponent;
}

/** Returns a display label for a component row. */
function compLabel(comp: FormComponent): string {
	if ("label" in comp && comp.label) return comp.label as string;
	if ("text" in comp && comp.text) return (comp.text as string).slice(0, 30);
	if ("key" in comp && comp.key) return comp.key as string;
	return comp.type;
}

/** Native two-panel form component editor. Zero external dependencies. */
export class FormEditor {
	private _form: FormDefinition | null = null;
	private _selectedId: string | null = null;
	private readonly _root: HTMLDivElement;
	private readonly _listPanel: HTMLDivElement;
	private readonly _listEl: HTMLDivElement;
	private readonly _propsPanel: HTMLDivElement;
	private readonly _handlers: Array<() => void> = [];
	private _destroyed = false;
	private _dropdownEl: HTMLDivElement | null = null;

	constructor(options: FormEditorOptions) {
		injectFormEditorStyles();

		this._root = document.createElement("div");
		this._root.className = `form-editor ${options.theme ?? "dark"}`;

		this._listPanel = document.createElement("div");
		this._listPanel.className = "fe-list-panel";

		// Toolbar
		const toolbar = document.createElement("div");
		toolbar.className = "fe-toolbar";

		const toolbarLabel = document.createElement("span");
		toolbarLabel.className = "fe-toolbar-label";
		toolbarLabel.textContent = "Components";
		toolbar.appendChild(toolbarLabel);

		const addBtn = document.createElement("button");
		addBtn.type = "button";
		addBtn.className = "fe-btn";
		addBtn.textContent = "+ Add";
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this._openAddDropdown(addBtn);
		});
		toolbar.appendChild(addBtn);

		this._listPanel.appendChild(toolbar);

		this._listEl = document.createElement("div");
		this._listEl.className = "fe-comp-list";
		this._listPanel.appendChild(this._listEl);

		this._propsPanel = document.createElement("div");
		this._propsPanel.className = "fe-props-panel";

		this._root.appendChild(this._listPanel);
		this._root.appendChild(this._propsPanel);
		options.container.appendChild(this._root);

		// Close dropdown on outside click
		document.addEventListener("click", this._closeDropdown);
	}

	async loadSchema(schema: Record<string, unknown>): Promise<void> {
		this._form = Form.parse(JSON.stringify(schema));
		this._selectedId = null;
		this._renderList();
		this._renderProps();
	}

	getSchema(): Record<string, unknown> {
		if (!this._form) return {};
		return JSON.parse(Form.export(this._form)) as Record<string, unknown>;
	}

	onChange(handler: () => void): () => void {
		this._handlers.push(handler);
		return () => {
			const idx = this._handlers.indexOf(handler);
			if (idx !== -1) this._handlers.splice(idx, 1);
		};
	}

	setTheme(theme: "dark" | "light"): void {
		this._root.className = `form-editor ${theme}`;
	}

	destroy(): void {
		this._destroyed = true;
		this._handlers.length = 0;
		document.removeEventListener("click", this._closeDropdown);
		this._closeDropdown();
		this._root.remove();
	}

	private _emit(): void {
		if (this._destroyed) return;
		for (const h of this._handlers) h();
	}

	// ── Add-component dropdown ──────────────────────────────────────────────────

	private readonly _closeDropdown = (): void => {
		this._dropdownEl?.remove();
		this._dropdownEl = null;
	};

	private _openAddDropdown(anchor: HTMLElement): void {
		this._closeDropdown();

		const dd = document.createElement("div");
		dd.className = "fe-add-dropdown";
		this._dropdownEl = dd;

		for (const group of ADD_GROUPS) {
			const groupLabel = document.createElement("div");
			groupLabel.className = "fe-add-dropdown-group";
			groupLabel.textContent = group.label;
			dd.appendChild(groupLabel);

			for (const type of group.types) {
				const item = document.createElement("div");
				item.className = "fe-add-dropdown-item";
				item.textContent = TYPE_LABELS[type] ?? type;
				item.addEventListener("click", () => {
					this._closeDropdown();
					this._addComponent(type);
				});
				dd.appendChild(item);
			}
		}

		document.body.appendChild(dd);
		const rect = anchor.getBoundingClientRect();
		dd.style.top = `${rect.bottom + 4}px`;
		dd.style.left = `${rect.left}px`;
	}

	private _addComponent(type: string): void {
		if (!this._form) return;
		const comp = makeDefaultComponent(type);
		this._form.components.push(comp);
		this._selectedId = comp.id;
		this._renderList();
		this._renderProps();
		this._emit();
	}

	// ── Flatten + find helpers ──────────────────────────────────────────────────

	/** Returns all (component, parent-list, index) triples in display order. */
	private _flatten(
		components: FormComponent[],
		depth = 0,
	): Array<{ comp: FormComponent; list: FormComponent[]; idx: number; depth: number }> {
		const result: Array<{
			comp: FormComponent;
			list: FormComponent[];
			idx: number;
			depth: number;
		}> = [];
		for (let i = 0; i < components.length; i++) {
			const comp = components[i];
			if (!comp) continue;
			result.push({ comp, list: components, idx: i, depth });
			if (CONTAINER_TYPES.has(comp.type)) {
				const children = (comp as FormGroupComponent).components ?? [];
				result.push(...this._flatten(children, depth + 1));
			}
		}
		return result;
	}

	private _findComp(
		id: string,
	): { comp: FormComponent; list: FormComponent[]; idx: number } | null {
		if (!this._form) return null;
		const all = this._flatten(this._form.components);
		const found = all.find((e) => e.comp.id === id);
		return found ?? null;
	}

	// ── List panel ──────────────────────────────────────────────────────────────

	private _renderList(): void {
		this._listEl.innerHTML = "";
		if (!this._form) return;
		const entries = this._flatten(this._form.components);
		for (const entry of entries) {
			this._listEl.appendChild(this._buildCompRow(entry.comp, entry.list, entry.idx, entry.depth));
		}
	}

	private _buildCompRow(
		comp: FormComponent,
		list: FormComponent[],
		idx: number,
		depth: number,
	): HTMLElement {
		const row = document.createElement("div");
		row.className = `fe-comp-row${comp.id === this._selectedId ? " selected" : ""}`;
		row.style.paddingLeft = `${10 + depth * 16}px`;

		const typeTag = document.createElement("span");
		typeTag.className = "fe-comp-type";
		typeTag.textContent = comp.type;
		row.appendChild(typeTag);

		const labelEl = document.createElement("span");
		labelEl.className = "fe-comp-label";
		labelEl.textContent = compLabel(comp);
		row.appendChild(labelEl);

		const actions = document.createElement("span");
		actions.className = "fe-comp-actions";

		if (idx > 0) {
			const upBtn = document.createElement("button");
			upBtn.type = "button";
			upBtn.className = "fe-btn fe-btn-icon";
			upBtn.title = "Move up";
			upBtn.textContent = "↑";
			upBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const prev = list[idx - 1];
				list[idx - 1] = comp;
				if (prev) list[idx] = prev;
				this._renderList();
				this._emit();
			});
			actions.appendChild(upBtn);
		}

		if (idx < list.length - 1) {
			const downBtn = document.createElement("button");
			downBtn.type = "button";
			downBtn.className = "fe-btn fe-btn-icon";
			downBtn.title = "Move down";
			downBtn.textContent = "↓";
			downBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const next = list[idx + 1];
				list[idx + 1] = comp;
				if (next) list[idx] = next;
				this._renderList();
				this._emit();
			});
			actions.appendChild(downBtn);
		}

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "fe-btn fe-btn-icon fe-btn-danger";
		delBtn.title = "Delete";
		delBtn.textContent = "×";
		delBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			list.splice(idx, 1);
			if (this._selectedId === comp.id) {
				this._selectedId = null;
				this._renderProps();
			}
			this._renderList();
			this._emit();
		});
		actions.appendChild(delBtn);

		row.appendChild(actions);

		row.addEventListener("click", () => {
			this._selectedId = comp.id;
			this._renderList();
			this._renderProps();
		});

		return row;
	}

	// ── Props panel ─────────────────────────────────────────────────────────────

	private _renderProps(): void {
		this._propsPanel.innerHTML = "";
		if (!this._selectedId) {
			const empty = document.createElement("div");
			empty.className = "fe-empty-props";
			empty.textContent = "Select a component to edit its properties";
			this._propsPanel.appendChild(empty);
			return;
		}
		const found = this._findComp(this._selectedId);
		if (!found) return;
		this._buildPropsFor(found.comp);
	}

	private _buildPropsFor(comp: FormComponent): void {
		const title = document.createElement("div");
		title.className = "fe-props-title";
		title.textContent = TYPE_LABELS[comp.type] ?? comp.type;
		this._propsPanel.appendChild(title);

		// Label property
		if ("label" in comp) {
			this._propsPanel.appendChild(
				this._propRow("Label", () => {
					const input = this._textInput(String(comp.label ?? ""), (v) => {
						(comp as { label: string }).label = v;
						// Update list display name
						this._renderList();
						this._emit();
					});
					return input;
				}),
			);
		}

		// Key property (field types)
		if (FIELD_TYPES.has(comp.type) && "key" in comp) {
			this._propsPanel.appendChild(
				this._propRow("Key", () => {
					return this._textInput(String((comp as { key?: string }).key ?? ""), (v) => {
						(comp as { key: string }).key = v;
						this._emit();
					});
				}),
			);
		}

		// Required validation
		if (FIELD_TYPES.has(comp.type) && "validate" in comp) {
			const validate = (comp as { validate?: { required?: boolean } }).validate ?? {};
			this._propsPanel.appendChild(
				this._propRow("Required", () => {
					return this._checkboxInput(validate.required ?? false, (v) => {
						(comp as { validate: { required: boolean } }).validate = { ...validate, required: v };
						this._emit();
					});
				}),
			);
		}

		// Text content (text component)
		if (comp.type === "text") {
			this._propsPanel.appendChild(
				this._propRow("Text (Markdown)", () => {
					return this._textareaInput((comp as { text: string }).text, (v) => {
						(comp as { text: string }).text = v;
						this._emit();
					});
				}),
			);
		}

		// HTML content
		if (comp.type === "html") {
			this._propsPanel.appendChild(
				this._propRow("HTML Content", () => {
					return this._textareaInput((comp as { content?: string }).content ?? "", (v) => {
						(comp as { content: string }).content = v;
						this._emit();
					});
				}),
			);
		}

		// Image source
		if (comp.type === "image") {
			this._propsPanel.appendChild(
				this._propRow("Source URL", () => {
					return this._textInput((comp as { source?: string }).source ?? "", (v) => {
						(comp as { source: string }).source = v;
						this._emit();
					});
				}),
			);
		}

		// iFrame URL
		if (comp.type === "iframe") {
			this._propsPanel.appendChild(
				this._propRow("URL", () => {
					return this._textInput((comp as { url?: string }).url ?? "", (v) => {
						(comp as { url: string }).url = v;
						this._emit();
					});
				}),
			);
		}

		// Expression
		if (comp.type === "expression") {
			this._propsPanel.appendChild(
				this._propRow("Expression", () => {
					return this._textInput((comp as { expression?: string }).expression ?? "", (v) => {
						(comp as { expression: string }).expression = v;
						this._emit();
					});
				}),
			);
		}

		// Options (select, radio, checklist, taglist)
		if (OPTION_TYPES.has(comp.type)) {
			const withValues = comp as { values?: FormValueOption[] };
			if (!withValues.values) withValues.values = [];
			this._propsPanel.appendChild(this._optionsEditor(withValues.values));
		}
	}

	// ── Property input helpers ──────────────────────────────────────────────────

	private _propRow(label: string, buildInput: () => HTMLElement): HTMLElement {
		const row = document.createElement("div");
		row.className = "fe-prop-row";
		const lbl = document.createElement("label");
		lbl.className = "fe-prop-label";
		lbl.textContent = label;
		row.appendChild(lbl);
		row.appendChild(buildInput());
		return row;
	}

	private _textInput(value: string, onChange: (v: string) => void): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "fe-prop-input";
		input.value = value;
		input.addEventListener("input", () => onChange(input.value));
		return input;
	}

	private _textareaInput(value: string, onChange: (v: string) => void): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "fe-prop-input";
		ta.value = value;
		ta.rows = 4;
		ta.style.resize = "vertical";
		ta.addEventListener("input", () => onChange(ta.value));
		return ta;
	}

	private _checkboxInput(checked: boolean, onChange: (v: boolean) => void): HTMLElement {
		const label = document.createElement("label");
		label.className = "fe-prop-checkbox";
		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = checked;
		cb.addEventListener("change", () => onChange(cb.checked));
		label.appendChild(cb);
		label.appendChild(document.createTextNode("Required"));
		return label;
	}

	private _optionsEditor(values: FormValueOption[]): HTMLElement {
		const section = document.createElement("div");
		const titleRow = document.createElement("div");
		titleRow.style.display = "flex";
		titleRow.style.alignItems = "center";
		titleRow.style.marginBottom = "6px";

		const lbl = document.createElement("span");
		lbl.className = "fe-prop-label";
		lbl.style.flex = "1";
		lbl.style.marginBottom = "0";
		lbl.textContent = "Options";
		titleRow.appendChild(lbl);

		const addOptBtn = document.createElement("button");
		addOptBtn.type = "button";
		addOptBtn.className = "fe-btn";
		addOptBtn.textContent = "+ Add";
		addOptBtn.addEventListener("click", () => {
			values.push({ label: "Option", value: `option_${uid()}` });
			rebuildList();
			this._emit();
		});
		titleRow.appendChild(addOptBtn);
		section.appendChild(titleRow);

		const list = document.createElement("div");
		list.className = "fe-options-list";
		section.appendChild(list);

		const rebuildList = (): void => {
			list.innerHTML = "";
			for (let i = 0; i < values.length; i++) {
				const opt = values[i];
				if (!opt) continue;
				const row = document.createElement("div");
				row.className = "fe-option-row";

				const labelIn = document.createElement("input");
				labelIn.type = "text";
				labelIn.className = "fe-prop-input";
				labelIn.placeholder = "Label";
				labelIn.value = opt.label;
				labelIn.addEventListener("input", () => {
					opt.label = labelIn.value;
					this._emit();
				});
				row.appendChild(labelIn);

				const valueIn = document.createElement("input");
				valueIn.type = "text";
				valueIn.className = "fe-prop-input";
				valueIn.placeholder = "Value";
				valueIn.value = opt.value;
				valueIn.addEventListener("input", () => {
					opt.value = valueIn.value;
					this._emit();
				});
				row.appendChild(valueIn);

				const delBtn = document.createElement("button");
				delBtn.type = "button";
				delBtn.className = "fe-btn fe-btn-icon fe-btn-danger";
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					values.splice(i, 1);
					rebuildList();
					this._emit();
				});
				row.appendChild(delBtn);

				list.appendChild(row);
			}
		};

		rebuildList();
		return section;
	}
}
