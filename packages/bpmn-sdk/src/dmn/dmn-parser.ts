import type { XmlElement } from "../types/xml-element.js";
import { parseXml } from "../xml/xml-parser.js";
import type {
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnDiagram,
	DmnDiagramShape,
	DmnInput,
	DmnInputEntry,
	DmnOutput,
	DmnOutputEntry,
	DmnRule,
	DmnTypeRef,
	HitPolicy,
} from "./dmn-model.js";

const DMN_NS = "https://www.omg.org/spec/DMN/20191111/MODEL/";

/** Strip namespace prefix from a tag name. */
function localName(name: string): string {
	const idx = name.indexOf(":");
	return idx >= 0 ? name.slice(idx + 1) : name;
}

/** Find child elements by local name. */
function findChildren(element: XmlElement, tagLocalName: string): XmlElement[] {
	return element.children.filter((c) => localName(c.name) === tagLocalName);
}

/** Find first child element by local name. */
function findChild(element: XmlElement, tagLocalName: string): XmlElement | undefined {
	return element.children.find((c) => localName(c.name) === tagLocalName);
}

/** Get attribute value, trying with and without namespace prefixes. */
function attr(element: XmlElement, name: string): string | undefined {
	// Try direct name first
	if (element.attributes[name] !== undefined) return element.attributes[name];
	// Try all prefixed variants
	for (const [key, value] of Object.entries(element.attributes)) {
		if (localName(key) === name) return value;
	}
	return undefined;
}

function requiredAttr(element: XmlElement, name: string): string {
	const value = attr(element, name);
	if (value === undefined) {
		throw new Error(`Missing required attribute "${name}" on element <${element.name}>`);
	}
	return value;
}

function parseTypeRef(value: string | undefined): DmnTypeRef | undefined {
	if (!value) return undefined;
	const valid = ["string", "boolean", "number", "date"];
	if (valid.includes(value)) return value as DmnTypeRef;
	return value as DmnTypeRef;
}

function parseHitPolicy(value: string | undefined): HitPolicy | undefined {
	if (!value) return undefined;
	return value as HitPolicy;
}

function parseInputExpression(el: XmlElement): DmnInput["inputExpression"] {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		typeRef: parseTypeRef(attr(el, "typeRef")),
		text: textEl?.text,
	};
}

function parseInput(el: XmlElement): DmnInput {
	const exprEl = findChild(el, "inputExpression");
	if (!exprEl) {
		throw new Error(`Missing <inputExpression> in input "${attr(el, "id")}"`);
	}
	return {
		id: requiredAttr(el, "id"),
		label: attr(el, "label"),
		inputExpression: parseInputExpression(exprEl),
	};
}

function parseOutput(el: XmlElement): DmnOutput {
	return {
		id: requiredAttr(el, "id"),
		label: attr(el, "label"),
		name: attr(el, "name"),
		typeRef: parseTypeRef(attr(el, "typeRef")),
	};
}

function parseInputEntry(el: XmlElement): DmnInputEntry {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		text: textEl?.text ?? "",
	};
}

function parseOutputEntry(el: XmlElement): DmnOutputEntry {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		text: textEl?.text ?? "",
	};
}

function parseRule(el: XmlElement): DmnRule {
	const descEl = findChild(el, "description");
	return {
		id: requiredAttr(el, "id"),
		description: descEl?.text,
		inputEntries: findChildren(el, "inputEntry").map(parseInputEntry),
		outputEntries: findChildren(el, "outputEntry").map(parseOutputEntry),
	};
}

function parseDecisionTable(el: XmlElement): DmnDecisionTable {
	return {
		id: requiredAttr(el, "id"),
		hitPolicy: parseHitPolicy(attr(el, "hitPolicy")),
		inputs: findChildren(el, "input").map(parseInput),
		outputs: findChildren(el, "output").map(parseOutput),
		rules: findChildren(el, "rule").map(parseRule),
	};
}

function parseDecision(el: XmlElement): DmnDecision {
	const tableEl = findChild(el, "decisionTable");
	if (!tableEl) {
		throw new Error(`Missing <decisionTable> in decision "${attr(el, "id")}"`);
	}

	const knownLocalNames = new Set(["decisionTable", "extensionElements"]);
	const extensionEls = findChild(el, "extensionElements");
	const unknownChildren = el.children.filter((c) => !knownLocalNames.has(localName(c.name)));

	return {
		id: requiredAttr(el, "id"),
		name: attr(el, "name"),
		decisionTable: parseDecisionTable(tableEl),
		extensionElements: extensionEls
			? extensionEls.children
			: unknownChildren.length > 0
				? unknownChildren
				: undefined,
	};
}

function parseDiagram(el: XmlElement): DmnDiagram {
	const diagramEl = findChild(el, "DMNDiagram");
	const shapes: DmnDiagramShape[] = [];

	if (diagramEl) {
		for (const shapeEl of findChildren(diagramEl, "DMNShape")) {
			const boundsEl = findChild(shapeEl, "Bounds");
			if (boundsEl) {
				shapes.push({
					dmnElementRef: requiredAttr(shapeEl, "dmnElementRef"),
					bounds: {
						x: Number(attr(boundsEl, "x") ?? "0"),
						y: Number(attr(boundsEl, "y") ?? "0"),
						width: Number(attr(boundsEl, "width") ?? "0"),
						height: Number(attr(boundsEl, "height") ?? "0"),
					},
				});
			}
		}
	}

	return { shapes };
}

/** Parse a DMN XML string into a typed DmnDefinitions model. */
export function parseDmn(xml: string): DmnDefinitions {
	const root = parseXml(xml);

	if (localName(root.name) !== "definitions") {
		throw new Error(`Expected <definitions> root element, got <${root.name}>`);
	}

	// Extract namespace declarations
	const namespaces: Record<string, string> = {};
	const modelerAttributes: Record<string, string> = {};

	for (const [key, value] of Object.entries(root.attributes)) {
		if (key.startsWith("xmlns:")) {
			namespaces[key.slice(6)] = value;
		} else if (key === "xmlns") {
			namespaces[""] = value;
		} else if (key.startsWith("modeler:")) {
			modelerAttributes[key.slice(8)] = value;
		}
	}

	const decisions = findChildren(root, "decision").map(parseDecision);

	const dmndiEl = findChild(root, "DMNDI");
	const diagram = dmndiEl ? parseDiagram(dmndiEl) : undefined;

	return {
		id: requiredAttr(root, "id"),
		name: requiredAttr(root, "name"),
		namespace: attr(root, "namespace") ?? DMN_NS,
		exporter: attr(root, "exporter"),
		exporterVersion: attr(root, "exporterVersion"),
		namespaces,
		modelerAttributes,
		decisions,
		diagram,
	};
}
