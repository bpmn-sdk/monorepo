import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseXml, serializeXml } from "../../src/xml/xml-parser.js";

const EXAMPLES_DIR = resolve(import.meta.dirname, "../../../../examples");

/** Recursively collect all element names from an XmlElement tree. */
function collectElementNames(el: {
	name: string;
	children: { name: string; children: unknown[] }[];
}): string[] {
	const names = [el.name];
	for (const child of el.children) {
		names.push(...collectElementNames(child as typeof el));
	}
	return names;
}

/** Recursively count total elements. */
function countElements(el: { children: { children: unknown[] }[] }): number {
	let count = 1;
	for (const child of el.children) {
		count += countElements(child as typeof el);
	}
	return count;
}

/** Recursively collect all attribute keys. */
function collectAttributeKeys(el: {
	attributes: Record<string, string>;
	children: unknown[];
}): string[] {
	const keys = Object.keys(el.attributes);
	for (const child of el.children) {
		keys.push(...collectAttributeKeys(child as typeof el));
	}
	return keys;
}

describe("XML Parser", () => {
	it("parses a simple XML element", () => {
		const xml = '<?xml version="1.0"?><root id="1"><child name="a"/></root>';
		const el = parseXml(xml);
		expect(el.name).toBe("root");
		expect(el.attributes.id).toBe("1");
		expect(el.children).toHaveLength(1);
		expect(el.children[0].name).toBe("child");
		expect(el.children[0].attributes.name).toBe("a");
	});

	it("preserves namespace prefixes in element names", () => {
		const xml =
			'<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"/></bpmn:definitions>';
		const el = parseXml(xml);
		expect(el.name).toBe("bpmn:definitions");
		expect(el.children[0].name).toBe("bpmn:process");
	});

	it("preserves namespace prefixes in attributes", () => {
		const xml =
			'<root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><child xsi:type="bpmn:tFormalExpression"/></root>';
		const el = parseXml(xml);
		expect(el.children[0].attributes["xsi:type"]).toBe("bpmn:tFormalExpression");
	});

	it("preserves text content", () => {
		const xml = "<root><text>Hello World</text></root>";
		const el = parseXml(xml);
		expect(el.children[0].text).toBe("Hello World");
	});

	it("throws on empty XML", () => {
		expect(() => parseXml("")).toThrow();
	});

	it("throws on XML with no root element", () => {
		expect(() => parseXml('<?xml version="1.0"?>')).toThrow("Failed to parse XML");
	});
});

describe("XML Serializer", () => {
	it("produces valid XML with declaration", () => {
		const xml = '<?xml version="1.0"?><root id="1"><child/></root>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(output).toContain('<root id="1">');
	});

	it("preserves namespace declarations", () => {
		const xml =
			'<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"><bpmn:process id="p"/></bpmn:definitions>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
		expect(output).toContain('xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"');
	});

	it("self-closes empty elements", () => {
		const xml = '<root><empty id="e"/></root>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('<empty id="e"/>');
	});
});

describe("XML Roundtrip - BPMN examples", () => {
	const bpmnFiles = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".bpmn"));

	for (const file of bpmnFiles) {
		it(`roundtrips ${file}`, () => {
			const xml = readFileSync(resolve(EXAMPLES_DIR, file), "utf-8");
			const parsed = parseXml(xml);
			const serialized = serializeXml(parsed);
			const reparsed = parseXml(serialized);

			// Same root element name
			expect(reparsed.name).toBe(parsed.name);

			// Same element count
			expect(countElements(reparsed)).toBe(countElements(parsed));

			// Same top-level children count
			expect(reparsed.children.length).toBe(parsed.children.length);

			// Same child element names at top level
			expect(reparsed.children.map((c) => c.name)).toEqual(parsed.children.map((c) => c.name));

			// Same namespace declarations on root
			const origNs = Object.entries(parsed.attributes)
				.filter(([k]) => k.startsWith("xmlns"))
				.sort(([a], [b]) => a.localeCompare(b));
			const roundNs = Object.entries(reparsed.attributes)
				.filter(([k]) => k.startsWith("xmlns"))
				.sort(([a], [b]) => a.localeCompare(b));
			expect(roundNs).toEqual(origNs);

			// Same non-xmlns attributes on root
			const origAttrs = Object.entries(parsed.attributes)
				.filter(([k]) => !k.startsWith("xmlns"))
				.sort(([a], [b]) => a.localeCompare(b));
			const roundAttrs = Object.entries(reparsed.attributes)
				.filter(([k]) => !k.startsWith("xmlns"))
				.sort(([a], [b]) => a.localeCompare(b));
			expect(roundAttrs).toEqual(origAttrs);
		});
	}
});

describe("XML Roundtrip - DMN examples", () => {
	const dmnFiles = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".dmn"));

	for (const file of dmnFiles) {
		it(`roundtrips ${file}`, () => {
			const xml = readFileSync(resolve(EXAMPLES_DIR, file), "utf-8");
			const parsed = parseXml(xml);
			const serialized = serializeXml(parsed);
			const reparsed = parseXml(serialized);

			expect(reparsed.name).toBe(parsed.name);
			expect(countElements(reparsed)).toBe(countElements(parsed));
			expect(reparsed.children.length).toBe(parsed.children.length);
		});
	}
});

describe("Namespace preservation", () => {
	it("preserves all 8 namespace prefixes from Handle PDP - Comment.bpmn", () => {
		const xml = readFileSync(resolve(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const parsed = parseXml(xml);

		const nsDecls = Object.keys(parsed.attributes).filter((k) => k.startsWith("xmlns:"));
		const prefixes = nsDecls.map((k) => k.replace("xmlns:", "")).sort();

		expect(prefixes).toContain("bpmn");
		expect(prefixes).toContain("bpmndi");
		expect(prefixes).toContain("dc");
		expect(prefixes).toContain("di");
		expect(prefixes).toContain("zeebe");
		expect(prefixes).toContain("modeler");
		expect(prefixes).toContain("xsi");
		expect(prefixes).toContain("camunda");
	});

	it("preserves namespaced element names throughout the tree", () => {
		const xml = readFileSync(resolve(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const parsed = parseXml(xml);
		const allNames = collectElementNames(parsed);

		// Should have bpmn: prefixed elements
		expect(allNames.some((n) => n.startsWith("bpmn:"))).toBe(true);
		// Should have bpmndi: prefixed elements
		expect(allNames.some((n) => n.startsWith("bpmndi:"))).toBe(true);
		// Should have zeebe: prefixed elements
		expect(allNames.some((n) => n.startsWith("zeebe:"))).toBe(true);
	});

	it("preserves xsi:type attributes on condition expressions", () => {
		const xml = readFileSync(resolve(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const parsed = parseXml(xml);
		const allAttrKeys = collectAttributeKeys(parsed);

		expect(allAttrKeys).toContain("xsi:type");
	});

	it("preserves camunda: namespace attributes", () => {
		const xml = readFileSync(resolve(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const parsed = parseXml(xml);

		// camunda:diagramRelationId should be on root
		expect(parsed.attributes["camunda:diagramRelationId"]).toBeDefined();
	});
});

describe("9-branch gateway", () => {
	it("parses the exclusive gateway with 9 outgoing branches", () => {
		const xml = readFileSync(resolve(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const parsed = parseXml(xml);

		// Find the process element
		const process = parsed.children.find((c) => c.name === "bpmn:process");
		expect(process).toBeDefined();

		// Find the exclusive gateway with 9 outgoing flows
		const gateways = process?.children.filter((c) => c.name === "bpmn:exclusiveGateway");
		const nineWay = gateways.find((g) => {
			const outgoing = g.children.filter((c) => c.name === "bpmn:outgoing");
			return outgoing.length === 9;
		});

		expect(nineWay).toBeDefined();
		expect(nineWay?.attributes.id).toBe("Gateway_0pqd380");
	});
});

describe("XML attribute escaping", () => {
	it("escapes double quotes in attribute values", () => {
		const element = {
			name: "root",
			attributes: {},
			children: [
				{
					name: "child",
					attributes: { source: '=x + "/path"', target: "url" },
					children: [],
				},
			],
		};

		const xml = serializeXml(element);
		expect(xml).toContain("&quot;/path&quot;");
		expect(xml).not.toContain('"/path"');

		// Roundtrip: parse the escaped XML and verify value is preserved
		const parsed = parseXml(xml);
		const child = parsed.children[0];
		expect(child?.attributes.source).toBe("=x + &quot;/path&quot;");
	});
});
