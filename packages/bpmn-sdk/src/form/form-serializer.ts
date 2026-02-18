import type {
	FormComponent,
	FormDefinition,
	FormGroupComponent,
	FormLayout,
} from "./form-model.js";

/** Serializes a FormDefinition to a JSON string. */
export function exportForm(form: FormDefinition): string {
	const obj: Record<string, unknown> = {};

	if (form.executionPlatform !== undefined) {
		obj.executionPlatform = form.executionPlatform;
	}
	if (form.executionPlatformVersion !== undefined) {
		obj.executionPlatformVersion = form.executionPlatformVersion;
	}
	if (form.exporter !== undefined) {
		obj.exporter = { name: form.exporter.name, version: form.exporter.version };
	}
	if (form.schemaVersion !== undefined) {
		obj.schemaVersion = form.schemaVersion;
	}
	obj.id = form.id;
	obj.components = form.components.map(serializeComponent);
	if (form.generated !== undefined) {
		obj.generated = form.generated;
	}
	obj.type = form.type;

	return JSON.stringify(obj, null, 2);
}

function serializeComponent(component: FormComponent): Record<string, unknown> {
	switch (component.type) {
		case "text":
			return buildObj(component, ["text", "label", "type", "layout", "id"]);
		case "textfield":
		case "textarea":
			return buildObj(component, [
				"label",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"defaultValue",
			]);
		case "select":
			return buildObj(component, [
				"label",
				"values",
				"valuesKey",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"searchable",
				"defaultValue",
			]);
		case "radio":
			return buildObj(component, [
				"label",
				"values",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"defaultValue",
			]);
		case "checkbox":
			return buildObj(component, [
				"label",
				"type",
				"id",
				"defaultValue",
				"validate",
				"key",
				"layout",
			]);
		case "checklist":
			return buildObj(component, ["label", "values", "type", "layout", "id", "key", "validate"]);
		case "group":
			return buildGroupObj(component);
	}
}

function buildObj(component: FormComponent, keys: readonly string[]): Record<string, unknown> {
	const src = component as unknown as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		const value = src[key];
		if (value === undefined) continue;
		if (key === "layout") {
			out.layout = serializeLayout(value as FormLayout);
		} else if (key === "validate") {
			out.validate = { ...(value as Record<string, unknown>) };
		} else if (key === "values") {
			out.values = (value as Array<Record<string, unknown>>).map((v) => ({
				label: v.label,
				value: v.value,
			}));
		} else {
			out[key] = value;
		}
	}
	return out;
}

function buildGroupObj(component: FormGroupComponent): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	out.label = component.label;
	out.components = component.components.map(serializeComponent);
	if (component.showOutline !== undefined) out.showOutline = component.showOutline;
	out.type = "group";
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout);
	out.id = component.id;
	return out;
}

function serializeLayout(layout: FormLayout): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (layout.row !== undefined) out.row = layout.row;
	if (layout.columns !== undefined) {
		out.columns = layout.columns;
	} else {
		out.columns = null;
	}
	return out;
}
