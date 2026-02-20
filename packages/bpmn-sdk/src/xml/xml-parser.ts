import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { XmlElement } from "../types/xml-element.js";

const ATTRS_KEY = ":@";
const TEXT_KEY = "#text";

const parserOptions = {
	preserveOrder: true,
	ignoreAttributes: false,
	attributeNamePrefix: "",
	textNodeName: TEXT_KEY,
	trimValues: false,
	parseTagValue: false,
	parseAttributeValue: false,
	processEntities: false,
	ignorePiTags: true,
} as const;

const builderOptions = {
	preserveOrder: true,
	ignoreAttributes: false,
	attributeNamePrefix: "",
	textNodeName: TEXT_KEY,
	format: true,
	indentBy: "  ",
	suppressEmptyNode: true,
	processEntities: false,
} as const;

/**
 * Parse an XML string into an XmlElement tree.
 * Returns the root element with all namespace prefixes preserved.
 * @throws Error if the XML has no root element.
 */
export function parseXml(xml: string): XmlElement {
	const parser = new XMLParser(parserOptions);
	const parsed: unknown[] = parser.parse(xml);

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error("Failed to parse XML: empty result");
	}

	for (const node of parsed) {
		const element = nodeToXmlElement(node as Record<string, unknown>);
		if (element) return element;
	}

	throw new Error("Failed to parse XML: no root element found");
}

function nodeToXmlElement(node: Record<string, unknown>): XmlElement | undefined {
	const attrs = (node[ATTRS_KEY] as Record<string, string> | undefined) ?? {};

	for (const key of Object.keys(node)) {
		if (key === ATTRS_KEY) continue;

		const childNodes = node[key] as Record<string, unknown>[];
		const children: XmlElement[] = [];
		let text: string | undefined;

		for (const child of childNodes) {
			if (TEXT_KEY in child) {
				const t = String(child[TEXT_KEY]);
				if (t.length > 0) {
					text = text === undefined ? t : text + t;
				}
				continue;
			}
			const converted = nodeToXmlElement(child);
			if (converted) children.push(converted);
		}

		return {
			name: key,
			attributes: { ...attrs },
			children,
			...(text !== undefined ? { text } : {}),
		};
	}

	return undefined;
}

/**
 * Serialize an XmlElement tree to an XML string.
 * Produces a well-formed XML document with declaration.
 */
export function serializeXml(element: XmlElement): string {
	const builder = new XMLBuilder(builderOptions);
	const data = [xmlElementToNode(element)];
	const xmlBody = (builder.build(data) as string).trimEnd();
	return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}\n`;
}

function xmlElementToNode(element: XmlElement): Record<string, unknown> {
	const children: unknown[] = [];

	if (element.text !== undefined) {
		children.push({ [TEXT_KEY]: element.text });
	}

	for (const child of element.children) {
		children.push(xmlElementToNode(child));
	}

	const node: Record<string, unknown> = { [element.name]: children };

	if (Object.keys(element.attributes).length > 0) {
		// Escape double quotes in attribute values since processEntities is disabled
		const escaped: Record<string, string> = {};
		for (const [key, value] of Object.entries(element.attributes)) {
			escaped[key] = value.replaceAll('"', "&quot;");
		}
		node[ATTRS_KEY] = escaped;
	}

	return node;
}
