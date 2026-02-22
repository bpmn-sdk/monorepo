import type {
	FormComponent,
	FormDefinition,
	FormExporter,
	FormLayout,
	FormValidation,
	FormValueOption,
} from "./form-model.js";

const VALID_COMPONENT_TYPES = new Set([
	"text",
	"textfield",
	"textarea",
	"select",
	"radio",
	"checkbox",
	"checklist",
	"group",
]);

/** Parses a Camunda Form JSON string into a typed FormDefinition. */
export function parseForm(json: string): FormDefinition {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch (e) {
		throw new Error(`Failed to parse form JSON: ${(e as Error).message}`);
	}

	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error("Form JSON must be an object");
	}

	const obj = raw as Record<string, unknown>;

	if (typeof obj.id !== "string" || obj.id.length === 0) {
		throw new Error("Form must have a non-empty 'id' string");
	}
	if (typeof obj.type !== "string") {
		throw new Error("Form must have a 'type' string");
	}
	if (!Array.isArray(obj.components)) {
		throw new Error("Form must have a 'components' array");
	}

	const definition: FormDefinition = {
		id: obj.id,
		type: obj.type,
		components: obj.components.map((c: unknown, i: number) =>
			parseComponent(c, `components[${i}]`),
		),
	};

	if (typeof obj.executionPlatform === "string") {
		definition.executionPlatform = obj.executionPlatform;
	}
	if (typeof obj.executionPlatformVersion === "string") {
		definition.executionPlatformVersion = obj.executionPlatformVersion;
	}
	if (typeof obj.schemaVersion === "number") {
		definition.schemaVersion = obj.schemaVersion;
	}
	if (typeof obj.generated === "boolean") {
		definition.generated = obj.generated;
	}
	if (typeof obj.exporter === "object" && obj.exporter !== null) {
		const exp = obj.exporter as Record<string, unknown>;
		definition.exporter = {
			name: String(exp.name ?? ""),
			version: String(exp.version ?? ""),
		} satisfies FormExporter;
	}

	return definition;
}

function parseComponent(raw: unknown, path: string): FormComponent {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`${path}: component must be an object`);
	}

	const obj = raw as Record<string, unknown>;

	if (typeof obj.type !== "string" || !VALID_COMPONENT_TYPES.has(obj.type)) {
		throw new Error(
			`${path}: component must have a valid 'type' (got ${JSON.stringify(obj.type)})`,
		);
	}
	if (typeof obj.id !== "string" || obj.id.length === 0) {
		throw new Error(`${path}: component must have a non-empty 'id'`);
	}

	const layout = parseLayout(obj.layout, path);

	switch (obj.type) {
		case "text": {
			if (typeof obj.text !== "string") {
				throw new Error(`${path}: text component must have a 'text' string`);
			}
			const c: FormComponent = { type: "text", id: obj.id, text: obj.text };
			if (typeof obj.label === "string") c.label = obj.label;
			if (layout) c.layout = layout;
			return c;
		}
		case "textfield":
			return parseFieldComponent(obj, "textfield", path, layout);
		case "textarea":
			return parseFieldComponent(obj, "textarea", path, layout);
		case "select":
			return parseSelectComponent(obj, path, layout);
		case "radio":
			return parseValuesComponent(obj, "radio", path, layout);
		case "checkbox":
			return parseCheckboxComponent(obj, path, layout);
		case "checklist":
			return parseValuesComponent(obj, "checklist", path, layout);
		case "group":
			return parseGroupComponent(obj, path, layout);
		default:
			throw new Error(`${path}: unknown component type '${obj.type}'`);
	}
}

function parseLayout(raw: unknown, path: string): FormLayout | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error(`${path}.layout: must be an object`);
	}
	const obj = raw as Record<string, unknown>;
	const layout: FormLayout = {};
	if (typeof obj.row === "string") layout.row = obj.row;
	if (obj.columns === null) {
		layout.columns = null;
	} else if (typeof obj.columns === "number") {
		layout.columns = obj.columns;
	}
	return layout;
}

function parseValidation(raw: unknown, path: string): FormValidation | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error(`${path}.validate: must be an object`);
	}
	const obj = raw as Record<string, unknown>;
	const v: FormValidation = {};
	if (typeof obj.required === "boolean") v.required = obj.required;
	if (typeof obj.minLength === "number") v.minLength = obj.minLength;
	if (typeof obj.maxLength === "number") v.maxLength = obj.maxLength;
	return v;
}

function parseValues(raw: unknown, path: string): FormValueOption[] {
	if (!Array.isArray(raw)) {
		throw new Error(`${path}.values: must be an array`);
	}
	return raw.map((v: unknown, i: number) => {
		if (typeof v !== "object" || v === null) {
			throw new Error(`${path}.values[${i}]: must be an object`);
		}
		const vo = v as Record<string, unknown>;
		return {
			label: String(vo.label ?? ""),
			value: String(vo.value ?? ""),
		};
	});
}

function parseFieldComponent(
	obj: Record<string, unknown>,
	type: "textfield" | "textarea",
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: ${type} must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: ${type} must have a 'key' string`);
	}
	const validate = parseValidation(obj.validate, path);
	const base = {
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
		...(validate ? { validate } : {}),
		...(typeof obj.defaultValue === "string" ? { defaultValue: obj.defaultValue } : {}),
		...(layout ? { layout } : {}),
	};
	if (type === "textfield") return { type: "textfield", ...base };
	return { type: "textarea", ...base };
}

function parseSelectComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: select must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: select must have a 'key' string`);
	}
	const c: FormComponent = {
		type: "select",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
	};
	if (Array.isArray(obj.values)) {
		c.values = parseValues(obj.values, path);
	}
	if (typeof obj.valuesKey === "string") c.valuesKey = obj.valuesKey;
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (typeof obj.searchable === "boolean") c.searchable = obj.searchable;
	if (typeof obj.defaultValue === "string") c.defaultValue = obj.defaultValue;
	if (layout) c.layout = layout;
	return c;
}

function parseValuesComponent(
	obj: Record<string, unknown>,
	type: "radio" | "checklist",
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: ${type} must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: ${type} must have a 'key' string`);
	}
	if (!Array.isArray(obj.values)) {
		throw new Error(`${path}: ${type} must have a 'values' array`);
	}
	const values = parseValues(obj.values, path);

	if (type === "radio") {
		const c: FormComponent = {
			type: "radio",
			id: obj.id as string,
			label: obj.label,
			key: obj.key,
			values,
		};
		const validate = parseValidation(obj.validate, path);
		if (validate) c.validate = validate;
		if (typeof obj.defaultValue === "string") c.defaultValue = obj.defaultValue;
		if (layout) c.layout = layout;
		return c;
	}

	const c: FormComponent = {
		type: "checklist",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
		values,
	};
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (layout) c.layout = layout;
	return c;
}

function parseCheckboxComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: checkbox must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: checkbox must have a 'key' string`);
	}
	const c: FormComponent = {
		type: "checkbox",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
	};
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (typeof obj.defaultValue === "boolean") c.defaultValue = obj.defaultValue;
	if (layout) c.layout = layout;
	return c;
}

function parseGroupComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: group must have a 'label' string`);
	}
	if (!Array.isArray(obj.components)) {
		throw new Error(`${path}: group must have a 'components' array`);
	}
	const components = obj.components.map((c: unknown, i: number) =>
		parseComponent(c, `${path}.components[${i}]`),
	);
	const c: FormComponent = {
		type: "group",
		id: obj.id as string,
		label: obj.label,
		components,
	};
	if (typeof obj.showOutline === "boolean") c.showOutline = obj.showOutline;
	if (layout) c.layout = layout;
	return c;
}
