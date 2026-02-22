import type { XmlElement } from "../types/xml-element.js";
import { serializeXml } from "../xml/xml-parser.js";
import type {
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnDiagram,
	DmnInput,
	DmnOutput,
	DmnRule,
} from "./dmn-model.js";

function textElement(parentName: string, text: string): XmlElement {
	return { name: "text", attributes: {}, children: [], text };
}

function serializeInput(input: DmnInput): XmlElement {
	const exprAttrs: Record<string, string> = { id: input.inputExpression.id };
	if (input.inputExpression.typeRef) {
		exprAttrs.typeRef = input.inputExpression.typeRef;
	}

	const exprChildren: XmlElement[] = [];
	if (input.inputExpression.text) {
		exprChildren.push(textElement("text", input.inputExpression.text));
	}

	const inputAttrs: Record<string, string> = { id: input.id };
	if (input.label) inputAttrs.label = input.label;

	return {
		name: "input",
		attributes: inputAttrs,
		children: [
			{
				name: "inputExpression",
				attributes: exprAttrs,
				children: exprChildren,
			},
		],
	};
}

function serializeOutput(output: DmnOutput): XmlElement {
	const attrs: Record<string, string> = { id: output.id };
	if (output.label) attrs.label = output.label;
	if (output.name) attrs.name = output.name;
	if (output.typeRef) attrs.typeRef = output.typeRef;

	return { name: "output", attributes: attrs, children: [] };
}

function serializeRule(rule: DmnRule): XmlElement {
	const children: XmlElement[] = [];

	if (rule.description) {
		children.push({
			name: "description",
			attributes: {},
			children: [],
			text: rule.description,
		});
	}

	for (const entry of rule.inputEntries) {
		children.push({
			name: "inputEntry",
			attributes: { id: entry.id },
			children: [textElement("text", entry.text)],
		});
	}

	for (const entry of rule.outputEntries) {
		children.push({
			name: "outputEntry",
			attributes: { id: entry.id },
			children: [textElement("text", entry.text)],
		});
	}

	return {
		name: "rule",
		attributes: { id: rule.id },
		children,
	};
}

function serializeDecisionTable(table: DmnDecisionTable): XmlElement {
	const attrs: Record<string, string> = { id: table.id };
	if (table.hitPolicy && table.hitPolicy !== "UNIQUE") {
		attrs.hitPolicy = table.hitPolicy;
	}

	const children: XmlElement[] = [
		...table.inputs.map(serializeInput),
		...table.outputs.map(serializeOutput),
		...table.rules.map(serializeRule),
	];

	return { name: "decisionTable", attributes: attrs, children };
}

function serializeDecision(decision: DmnDecision): XmlElement {
	const children: XmlElement[] = [];

	if (decision.extensionElements && decision.extensionElements.length > 0) {
		children.push({
			name: "extensionElements",
			attributes: {},
			children: decision.extensionElements,
		});
	}

	children.push(serializeDecisionTable(decision.decisionTable));

	const attrs: Record<string, string> = { id: decision.id };
	if (decision.name) attrs.name = decision.name;

	return { name: "decision", attributes: attrs, children };
}

function serializeDiagram(diagram: DmnDiagram): XmlElement {
	const shapes: XmlElement[] = diagram.shapes.map((shape) => ({
		name: "dmndi:DMNShape",
		attributes: { dmnElementRef: shape.dmnElementRef },
		children: [
			{
				name: "dc:Bounds",
				attributes: {
					height: String(shape.bounds.height),
					width: String(shape.bounds.width),
					x: String(shape.bounds.x),
					y: String(shape.bounds.y),
				},
				children: [],
			},
		],
	}));

	return {
		name: "dmndi:DMNDI",
		attributes: {},
		children: [
			{
				name: "dmndi:DMNDiagram",
				attributes: {},
				children: shapes,
			},
		],
	};
}

/** Serialize a DmnDefinitions model to a DMN XML string. */
export function serializeDmn(definitions: DmnDefinitions): string {
	const attrs: Record<string, string> = {};

	// Namespace declarations
	for (const [prefix, uri] of Object.entries(definitions.namespaces)) {
		if (prefix === "") {
			attrs.xmlns = uri;
		} else {
			attrs[`xmlns:${prefix}`] = uri;
		}
	}

	attrs.id = definitions.id;
	attrs.name = definitions.name;
	attrs.namespace = definitions.namespace;

	if (definitions.exporter) attrs.exporter = definitions.exporter;
	if (definitions.exporterVersion) attrs.exporterVersion = definitions.exporterVersion;

	// Modeler attributes
	for (const [key, value] of Object.entries(definitions.modelerAttributes)) {
		attrs[`modeler:${key}`] = value;
	}

	const children: XmlElement[] = [];

	for (const decision of definitions.decisions) {
		children.push(serializeDecision(decision));
	}

	if (definitions.diagram) {
		children.push(serializeDiagram(definitions.diagram));
	}

	const root: XmlElement = {
		name: "definitions",
		attributes: attrs,
		children,
	};

	return serializeXml(root);
}
