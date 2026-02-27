import { Dmn } from "@bpmn-sdk/core";
import type {
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnInput,
	DmnInputEntry,
	DmnOutput,
	DmnOutputEntry,
	DmnRule,
	HitPolicy,
} from "@bpmn-sdk/core";
import { injectDmnEditorStyles } from "./css.js";

export interface DmnEditorOptions {
	container: HTMLElement;
}

const HIT_POLICIES: HitPolicy[] = [
	"UNIQUE",
	"FIRST",
	"ANY",
	"COLLECT",
	"RULE ORDER",
	"OUTPUT ORDER",
	"PRIORITY",
];

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

/** Native editable decision table editor. Zero external dependencies. */
export class DmnEditor {
	private _defs: DmnDefinitions | null = null;
	private readonly _root: HTMLDivElement;
	private readonly _body: HTMLDivElement;
	private readonly _handlers: Array<() => void> = [];
	private _destroyed = false;

	constructor(options: DmnEditorOptions) {
		injectDmnEditorStyles();

		this._root = document.createElement("div");
		this._root.className = "dmn-editor dark";
		this._body = document.createElement("div");
		this._body.className = "dmn-editor-body";
		this._root.appendChild(this._body);
		options.container.appendChild(this._root);
	}

	async loadXML(xml: string): Promise<void> {
		this._defs = Dmn.parse(xml);
		this._render();
	}

	async getXML(): Promise<string> {
		if (!this._defs) return "";
		return Dmn.export(this._defs);
	}

	onChange(handler: () => void): () => void {
		this._handlers.push(handler);
		return () => {
			const idx = this._handlers.indexOf(handler);
			if (idx !== -1) this._handlers.splice(idx, 1);
		};
	}

	destroy(): void {
		this._destroyed = true;
		this._handlers.length = 0;
		this._root.remove();
	}

	private _emit(): void {
		if (this._destroyed) return;
		for (const h of this._handlers) h();
	}

	private _render(): void {
		this._body.innerHTML = "";
		if (!this._defs) return;
		for (const decision of this._defs.decisions) {
			this._body.appendChild(this._renderDecision(decision));
		}
	}

	private _renderDecision(decision: DmnDecision): HTMLElement {
		const dt = decision.decisionTable;
		const section = document.createElement("div");
		section.className = "dme-decision";

		// Header row: name input + hit policy select
		const header = document.createElement("div");
		header.className = "dme-decision-header";

		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.className = "dme-name-input";
		nameInput.value = decision.name ?? "";
		nameInput.placeholder = "Decision name";
		nameInput.addEventListener("input", () => {
			decision.name = nameInput.value;
			this._emit();
		});
		header.appendChild(nameInput);

		const hpSelect = document.createElement("select");
		hpSelect.className = "dme-hp-select";
		for (const hp of HIT_POLICIES) {
			const opt = document.createElement("option");
			opt.value = hp;
			opt.textContent = hp;
			opt.selected = (dt.hitPolicy ?? "UNIQUE") === hp;
			hpSelect.appendChild(opt);
		}
		hpSelect.addEventListener("change", () => {
			dt.hitPolicy = hpSelect.value as HitPolicy;
			this._emit();
		});
		header.appendChild(hpSelect);

		section.appendChild(header);

		// Build table wrapper so we can re-render it on structural changes
		const tableWrapper = document.createElement("div");
		const renderTable = (): void => {
			tableWrapper.innerHTML = "";
			tableWrapper.appendChild(this._buildTable(dt, renderTable));
		};
		renderTable();
		section.appendChild(tableWrapper);

		// Add rule button
		const addRuleBtn = document.createElement("button");
		addRuleBtn.type = "button";
		addRuleBtn.className = "dme-btn dme-add-rule";
		addRuleBtn.textContent = "+ Add Rule";
		addRuleBtn.addEventListener("click", () => {
			const inputEntries: DmnInputEntry[] = dt.inputs.map(() => ({ id: uid(), text: "" }));
			const outputEntries: DmnOutputEntry[] = dt.outputs.map(() => ({ id: uid(), text: "" }));
			dt.rules.push({ id: uid(), inputEntries, outputEntries });
			renderTable();
			this._emit();
		});
		section.appendChild(addRuleBtn);

		return section;
	}

	private _buildTable(dt: DmnDecisionTable, rerender: () => void): HTMLTableElement {
		const table = document.createElement("table");
		table.className = "dme-table";

		// ── thead ──
		const thead = document.createElement("thead");

		// Row 1: type headers (INPUT / OUTPUT / actions)
		const typeRow = document.createElement("tr");

		const numTh = document.createElement("th");
		numTh.rowSpan = 2;
		typeRow.appendChild(numTh);

		if (dt.inputs.length > 0) {
			const inputTh = document.createElement("th");
			inputTh.colSpan = dt.inputs.length;
			inputTh.className = "dme-th-input";
			inputTh.textContent = "Input";
			typeRow.appendChild(inputTh);
		}
		if (dt.outputs.length > 0) {
			const outputTh = document.createElement("th");
			outputTh.colSpan = dt.outputs.length;
			outputTh.className = "dme-th-output";
			outputTh.textContent = "Output";
			typeRow.appendChild(outputTh);
		}

		// + add input / + add output column buttons
		const addColTh = document.createElement("th");
		addColTh.rowSpan = 2;
		addColTh.className = "dme-th-actions";

		const addInBtn = document.createElement("button");
		addInBtn.type = "button";
		addInBtn.className = "dme-btn dme-btn-icon";
		addInBtn.title = "Add input column";
		addInBtn.textContent = "+I";
		addInBtn.addEventListener("click", () => {
			const colId = uid();
			dt.inputs.push({ id: colId, label: "", inputExpression: { id: uid(), text: "" } });
			for (const rule of dt.rules) {
				rule.inputEntries.push({ id: uid(), text: "" });
			}
			rerender();
			this._emit();
		});
		addColTh.appendChild(addInBtn);

		const addOutBtn = document.createElement("button");
		addOutBtn.type = "button";
		addOutBtn.className = "dme-btn dme-btn-icon";
		addOutBtn.title = "Add output column";
		addOutBtn.textContent = "+O";
		addOutBtn.style.marginTop = "2px";
		addOutBtn.addEventListener("click", () => {
			dt.outputs.push({ id: uid(), label: "", name: "" });
			for (const rule of dt.rules) {
				rule.outputEntries.push({ id: uid(), text: "" });
			}
			rerender();
			this._emit();
		});
		addColTh.appendChild(addOutBtn);

		typeRow.appendChild(addColTh);
		thead.appendChild(typeRow);

		// Row 2: per-column label/expr headers
		const colRow = document.createElement("tr");

		for (let i = 0; i < dt.inputs.length; i++) {
			const input = dt.inputs[i];
			if (!input) continue;
			const th = document.createElement("th");
			th.className = "dme-th-input";
			th.appendChild(this._buildColHeader(input, i, dt, rerender));
			colRow.appendChild(th);
		}
		for (let i = 0; i < dt.outputs.length; i++) {
			const output = dt.outputs[i];
			if (!output) continue;
			const th = document.createElement("th");
			th.className = "dme-th-output";
			th.appendChild(this._buildOutputColHeader(output, i, dt, rerender));
			colRow.appendChild(th);
		}
		thead.appendChild(colRow);
		table.appendChild(thead);

		// ── tbody ──
		const tbody = document.createElement("tbody");
		for (let ri = 0; ri < dt.rules.length; ri++) {
			const rule = dt.rules[ri];
			if (!rule) continue;
			tbody.appendChild(this._buildRuleRow(rule, ri, dt, rerender));
		}
		table.appendChild(tbody);

		return table;
	}

	private _buildColHeader(
		input: DmnInput,
		colIdx: number,
		dt: DmnDecisionTable,
		rerender: () => void,
	): HTMLElement {
		const wrap = document.createElement("div");
		wrap.className = "dme-th-inner";

		const labelIn = document.createElement("input");
		labelIn.type = "text";
		labelIn.className = "dme-col-label";
		labelIn.value = input.label ?? "";
		labelIn.placeholder = "Label";
		labelIn.addEventListener("input", () => {
			input.label = labelIn.value;
			this._emit();
		});
		wrap.appendChild(labelIn);

		const exprIn = document.createElement("input");
		exprIn.type = "text";
		exprIn.className = "dme-col-expr";
		exprIn.value = input.inputExpression.text ?? "";
		exprIn.placeholder = "Expression";
		exprIn.addEventListener("input", () => {
			input.inputExpression.text = exprIn.value;
			this._emit();
		});
		wrap.appendChild(exprIn);

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "dme-btn dme-btn-icon";
		delBtn.title = "Remove input column";
		delBtn.textContent = "×";
		delBtn.addEventListener("click", () => {
			dt.inputs.splice(colIdx, 1);
			for (const rule of dt.rules) {
				rule.inputEntries.splice(colIdx, 1);
			}
			rerender();
			this._emit();
		});
		wrap.appendChild(delBtn);

		return wrap;
	}

	private _buildOutputColHeader(
		output: DmnOutput,
		colIdx: number,
		dt: DmnDecisionTable,
		rerender: () => void,
	): HTMLElement {
		const wrap = document.createElement("div");
		wrap.className = "dme-th-inner";

		const labelIn = document.createElement("input");
		labelIn.type = "text";
		labelIn.className = "dme-col-label";
		labelIn.value = output.label ?? "";
		labelIn.placeholder = "Label";
		labelIn.addEventListener("input", () => {
			output.label = labelIn.value;
			this._emit();
		});
		wrap.appendChild(labelIn);

		const nameIn = document.createElement("input");
		nameIn.type = "text";
		nameIn.className = "dme-col-expr";
		nameIn.value = output.name ?? "";
		nameIn.placeholder = "Variable";
		nameIn.addEventListener("input", () => {
			output.name = nameIn.value;
			this._emit();
		});
		wrap.appendChild(nameIn);

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "dme-btn dme-btn-icon";
		delBtn.title = "Remove output column";
		delBtn.textContent = "×";
		delBtn.addEventListener("click", () => {
			dt.outputs.splice(colIdx, 1);
			for (const rule of dt.rules) {
				rule.outputEntries.splice(colIdx, 1);
			}
			rerender();
			this._emit();
		});
		wrap.appendChild(delBtn);

		return wrap;
	}

	private _buildRuleRow(
		rule: DmnRule,
		ruleIdx: number,
		dt: DmnDecisionTable,
		rerender: () => void,
	): HTMLTableRowElement {
		const tr = document.createElement("tr");

		const numTd = document.createElement("td");
		numTd.className = "dme-row-num";
		numTd.textContent = String(ruleIdx + 1);
		tr.appendChild(numTd);

		for (let i = 0; i < dt.inputs.length; i++) {
			const entry = rule.inputEntries[i];
			if (!entry) continue;
			const td = document.createElement("td");
			td.appendChild(this._buildEntryInput(entry));
			tr.appendChild(td);
		}

		for (let i = 0; i < dt.outputs.length; i++) {
			const entry = rule.outputEntries[i];
			if (!entry) continue;
			const td = document.createElement("td");
			td.appendChild(this._buildEntryInput(entry));
			tr.appendChild(td);
		}

		const actionsTd = document.createElement("td");
		actionsTd.className = "dme-td-actions";
		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "dme-btn dme-btn-icon";
		delBtn.title = "Delete rule";
		delBtn.textContent = "×";
		delBtn.addEventListener("click", () => {
			dt.rules.splice(ruleIdx, 1);
			rerender();
			this._emit();
		});
		actionsTd.appendChild(delBtn);
		tr.appendChild(actionsTd);

		return tr;
	}

	private _buildEntryInput(entry: DmnInputEntry | DmnOutputEntry): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "dme-entry";
		ta.value = entry.text;
		ta.rows = 1;
		ta.spellcheck = false;
		ta.addEventListener("input", () => {
			entry.text = ta.value;
			// Auto-resize
			ta.style.height = "auto";
			ta.style.height = `${ta.scrollHeight}px`;
			this._emit();
		});
		return ta;
	}
}
