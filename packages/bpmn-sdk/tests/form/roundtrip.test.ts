import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
	FormComponent,
	FormDefinition,
	FormGroupComponent,
} from "../../src/form/form-model.js";
import { parseForm } from "../../src/form/form-parser.js";
import { exportForm } from "../../src/form/form-serializer.js";

const EXAMPLES_DIR = resolve(import.meta.dirname, "../../../..", "examples");

const FORM_FILES = [
	"Form > FinOps Cloud Request.form",
	"Transition form > Define to Implement.form",
	"Transition form >  Discover to Define.form",
] as const;

function normalize(obj: unknown): unknown {
	return JSON.parse(JSON.stringify(obj));
}

function assertSemanticallyEqual(a: FormDefinition, b: FormDefinition): void {
	expect(normalize(a)).toEqual(normalize(b));
}

function loadForm(index: number): FormDefinition {
	const file = FORM_FILES[index as 0 | 1 | 2];
	return parseForm(readFileSync(resolve(EXAMPLES_DIR, file), "utf-8"));
}

function at<T>(arr: readonly T[], index: number): T {
	const item = arr[index];
	if (item === undefined) throw new Error(`No item at index ${index}`);
	return item;
}

function asGroup(c: FormComponent): FormGroupComponent {
	if (c.type !== "group") throw new Error(`Expected group, got ${c.type}`);
	return c;
}

describe("Form roundtrip", () => {
	for (const file of FORM_FILES) {
		it(`roundtrips ${file}`, () => {
			const json = readFileSync(resolve(EXAMPLES_DIR, file), "utf-8");
			const parsed = parseForm(json);
			const exported = exportForm(parsed);
			const reparsed = parseForm(exported);
			assertSemanticallyEqual(parsed, reparsed);
		});
	}
});

describe("Form parser", () => {
	it("parses FinOps form metadata", () => {
		const form = loadForm(0);
		expect(form.id).toBe("Form_02f7j6q");
		expect(form.type).toBe("default");
		expect(form.executionPlatform).toBe("Camunda Cloud");
		expect(form.executionPlatformVersion).toBe("8.7.0");
		expect(form.exporter).toEqual({ name: "Camunda Web Modeler", version: "a131ae4" });
		expect(form.schemaVersion).toBe(18);
		expect(form.components).toHaveLength(9);
	});

	it("parses text components", () => {
		const form = loadForm(0);
		const text = at(form.components, 0);
		expect(text.type).toBe("text");
		if (text.type !== "text") throw new Error("unreachable");
		expect(text.text).toBe("## Cloud Request form");
		expect(text.id).toBe("Field_1rs3ow3");
		expect(text.layout).toEqual({ row: "Row_0nvb02j", columns: null });
	});

	it("parses textfield components with validation", () => {
		const form = loadForm(0);
		const tf = at(form.components, 3);
		expect(tf.type).toBe("textfield");
		if (tf.type !== "textfield") throw new Error("unreachable");
		expect(tf.label).toBe("Responsible team");
		expect(tf.key).toBe("finopsTeam");
		expect(tf.validate).toEqual({ required: true });
	});

	it("parses select components with values", () => {
		const form = loadForm(0);
		const sel = at(form.components, 5);
		expect(sel.type).toBe("select");
		if (sel.type !== "select") throw new Error("unreachable");
		expect(sel.label).toBe("Resource Scope:");
		expect(sel.values).toHaveLength(3);
	});

	it("parses select with valuesKey and searchable", () => {
		const form = loadForm(2);
		const sel = at(form.components, 2);
		expect(sel.type).toBe("select");
		if (sel.type !== "select") throw new Error("unreachable");
		expect(sel.valuesKey).toBe("repoCollaborators");
		expect(sel.searchable).toBe(true);
	});

	it("parses groups with nested components (recursive)", () => {
		const form = loadForm(1);
		const group = asGroup(at(form.components, 3));
		expect(group.label).toBe("QA");
		expect(group.showOutline).toBe(true);
		expect(group.components).toHaveLength(2);
		expect(at(group.components, 0).type).toBe("radio");
		expect(at(group.components, 1).type).toBe("textarea");
	});

	it("parses checkbox with defaultValue", () => {
		const form = loadForm(1);
		const group = asGroup(at(form.components, 2));
		const cb = at(group.components, 0);
		expect(cb.type).toBe("checkbox");
		if (cb.type !== "checkbox") throw new Error("unreachable");
		expect(cb.defaultValue).toBe(false);
	});

	it("parses checklist components", () => {
		const form = loadForm(2);
		const group = asGroup(at(form.components, 3));
		const cl = at(group.components, 0);
		expect(cl.type).toBe("checklist");
		if (cl.type !== "checklist") throw new Error("unreachable");
		expect(cl.values).toHaveLength(5);
	});

	it("parses radio with defaultValue", () => {
		const form = loadForm(2);
		const group = asGroup(at(form.components, 4));
		const radio = at(group.components, 0);
		expect(radio.type).toBe("radio");
		if (radio.type !== "radio") throw new Error("unreachable");
		expect(radio.defaultValue).toBe("false");
	});

	it("parses generated flag", () => {
		const form = loadForm(1);
		expect(form.generated).toBe(true);
	});

	it("parses textarea with validate minLength/maxLength", () => {
		const form = loadForm(1);
		const group = asGroup(at(form.components, 3));
		const ta = at(group.components, 1);
		expect(ta.type).toBe("textarea");
		if (ta.type !== "textarea") throw new Error("unreachable");
		expect(ta.validate).toEqual({ minLength: 10, maxLength: 500, required: false });
	});

	it("throws on invalid JSON", () => {
		expect(() => parseForm("{not valid")).toThrow("Failed to parse form JSON");
	});

	it("throws on missing id", () => {
		expect(() => parseForm('{"type":"default","components":[]}')).toThrow("non-empty 'id'");
	});

	it("throws on missing components", () => {
		expect(() => parseForm('{"id":"f1","type":"default"}')).toThrow("'components' array");
	});

	it("throws on invalid component type", () => {
		expect(() =>
			parseForm('{"id":"f1","type":"default","components":[{"id":"c1","type":"invalid"}]}'),
		).toThrow("valid 'type'");
	});
});

describe("Form serializer", () => {
	it("produces valid JSON", () => {
		const form = loadForm(0);
		const exported = exportForm(form);
		expect(() => JSON.parse(exported)).not.toThrow();
	});

	it("preserves all component count through serialization", () => {
		const form = loadForm(2);
		const exported = exportForm(form);
		const reparsed = parseForm(exported);
		expect(reparsed.components).toHaveLength(form.components.length);
	});
});
