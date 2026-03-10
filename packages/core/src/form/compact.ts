import { generateId } from "../types/id-generator.js"
import type { FormComponent, FormDefinition, FormValueOption } from "./form-model.js"

// ── Compact types ─────────────────────────────────────────────────────────────

export interface CompactFormField {
	type: string
	id: string
	label?: string
	key?: string
	required?: boolean
	values?: FormValueOption[]
	/** Nested fields for group and dynamiclist components */
	fields?: CompactFormField[]
}

export interface CompactForm {
	id: string
	fields: CompactFormField[]
}

// ── Compactify ────────────────────────────────────────────────────────────────

function compactifyComponent(c: FormComponent): CompactFormField {
	const base: CompactFormField = { type: c.type, id: c.id }
	const any = c as Record<string, unknown>

	if (typeof any.label === "string" && any.label) base.label = any.label
	if (typeof any.key === "string" && any.key) base.key = any.key
	if (any.validate && typeof any.validate === "object") {
		const validate = any.validate as Record<string, unknown>
		if (validate.required === true) base.required = true
	}
	if (Array.isArray(any.values)) base.values = any.values as FormValueOption[]

	// Nested components
	if (c.type === "group" || c.type === "dynamiclist") {
		const nested = "components" in c ? (c.components as FormComponent[]) : []
		if (nested.length > 0) {
			base.fields = nested.map(compactifyComponent)
		}
	}

	return base
}

/** Convert a FormDefinition to a token-efficient CompactForm representation. */
export function compactifyForm(def: FormDefinition): CompactForm {
	return {
		id: def.id,
		fields: def.components.map(compactifyComponent),
	}
}

// ── Expand ────────────────────────────────────────────────────────────────────

function expandField(f: CompactFormField): FormComponent {
	switch (f.type) {
		case "text":
			return { type: "text", id: f.id, text: f.label ?? "" }

		case "textfield":
			return {
				type: "textfield",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				validate: f.required ? { required: true } : undefined,
			}

		case "textarea":
			return {
				type: "textarea",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				validate: f.required ? { required: true } : undefined,
			}

		case "number":
			return {
				type: "number",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				validate: f.required ? { required: true } : undefined,
			}

		case "select":
			return {
				type: "select",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				values: f.values,
				validate: f.required ? { required: true } : undefined,
			}

		case "radio":
			return {
				type: "radio",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				values: f.values ?? [],
				validate: f.required ? { required: true } : undefined,
			}

		case "checkbox":
			return {
				type: "checkbox",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				validate: f.required ? { required: true } : undefined,
			}

		case "checklist":
			return {
				type: "checklist",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				values: f.values ?? [],
				validate: f.required ? { required: true } : undefined,
			}

		case "taglist":
			return {
				type: "taglist",
				id: f.id,
				label: f.label ?? "",
				key: f.key ?? generateId("field"),
				values: f.values,
				validate: f.required ? { required: true } : undefined,
			}

		case "datetime":
			return {
				type: "datetime",
				id: f.id,
				key: f.key ?? generateId("field"),
				validate: f.required ? { required: true } : undefined,
			}

		case "button":
			return { type: "button", id: f.id, label: f.label ?? "Submit" }

		case "separator":
			return { type: "separator", id: f.id }

		case "spacer":
			return { type: "spacer", id: f.id }

		case "group":
			return {
				type: "group",
				id: f.id,
				label: f.label ?? "",
				components: (f.fields ?? []).map(expandField),
			}

		case "dynamiclist":
			return {
				type: "dynamiclist",
				id: f.id,
				label: f.label,
				components: (f.fields ?? []).map(expandField),
			}

		default:
			return { type: f.type, id: f.id } as FormComponent
	}
}

/** Convert a CompactForm back to a full FormDefinition. */
export function expandForm(compact: CompactForm): FormDefinition {
	return {
		id: compact.id,
		type: "default",
		schemaVersion: 16,
		components: compact.fields.map(expandField),
	}
}
