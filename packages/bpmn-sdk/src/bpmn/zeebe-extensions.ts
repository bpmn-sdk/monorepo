import type { XmlElement } from "../types/xml-element.js";

/** Zeebe task definition extension. */
export interface ZeebeTaskDefinition {
	type: string;
	retries?: string;
}

/** A single Zeebe IO mapping entry. */
export interface ZeebeIoMappingEntry {
	source: string;
	target: string;
}

/** Zeebe IO mapping extension. */
export interface ZeebeIoMapping {
	inputs: ZeebeIoMappingEntry[];
	outputs: ZeebeIoMappingEntry[];
}

/** A single Zeebe task header entry. */
export interface ZeebeTaskHeaderEntry {
	key: string;
	value: string;
}

/** Zeebe task headers extension. */
export interface ZeebeTaskHeaders {
	headers: ZeebeTaskHeaderEntry[];
}

/** A single Zeebe property entry. */
export interface ZeebePropertyEntry {
	name: string;
	value: string;
}

/** Zeebe properties extension. */
export interface ZeebeProperties {
	properties: ZeebePropertyEntry[];
}

/** Zeebe ad-hoc sub-process extension (AI Agent job worker pattern). */
export interface ZeebeAdHoc {
	/** Variable name that collects tool call results from child tasks. */
	outputCollection?: string;
	/** FEEL expression mapping each child task's result into the collection. */
	outputElement?: string;
	/** FEEL expression selecting which child element IDs to activate (BPMN-native mode). */
	activeElementsCollection?: string;
}

/** Collected Zeebe extensions on a service task. */
export interface ZeebeExtensions {
	taskDefinition?: ZeebeTaskDefinition;
	ioMapping?: ZeebeIoMapping;
	taskHeaders?: ZeebeTaskHeaders;
	properties?: ZeebeProperties;
	adHoc?: ZeebeAdHoc;
	/** Unrecognized extension elements preserved for roundtrip. */
	unknownElements?: XmlElement[];
}

/** Convert Zeebe extensions to XmlElement array for the BPMN model. */
export function zeebeExtensionsToXmlElements(extensions: ZeebeExtensions): XmlElement[] {
	const elements: XmlElement[] = [];

	if (extensions.taskDefinition) {
		const attrs: Record<string, string> = {
			type: extensions.taskDefinition.type,
		};
		if (extensions.taskDefinition.retries !== undefined) {
			attrs.retries = extensions.taskDefinition.retries;
		}
		elements.push({
			name: "zeebe:taskDefinition",
			attributes: attrs,
			children: [],
		});
	}

	if (extensions.ioMapping) {
		const children: XmlElement[] = [];
		for (const input of extensions.ioMapping.inputs) {
			children.push({
				name: "zeebe:input",
				attributes: { source: input.source, target: input.target },
				children: [],
			});
		}
		for (const output of extensions.ioMapping.outputs) {
			children.push({
				name: "zeebe:output",
				attributes: { source: output.source, target: output.target },
				children: [],
			});
		}
		elements.push({
			name: "zeebe:ioMapping",
			attributes: {},
			children,
		});
	}

	if (extensions.taskHeaders) {
		const children: XmlElement[] = extensions.taskHeaders.headers.map((header) => ({
			name: "zeebe:header",
			attributes: { key: header.key, value: header.value },
			children: [],
		}));
		elements.push({
			name: "zeebe:taskHeaders",
			attributes: {},
			children,
		});
	}

	if (extensions.properties) {
		const children: XmlElement[] = extensions.properties.properties.map((prop) => ({
			name: "zeebe:property",
			attributes: { name: prop.name, value: prop.value },
			children: [],
		}));
		elements.push({
			name: "zeebe:properties",
			attributes: {},
			children,
		});
	}

	if (extensions.adHoc) {
		const attrs: Record<string, string> = {};
		const { outputCollection, outputElement, activeElementsCollection } = extensions.adHoc;
		if (outputCollection) attrs.outputCollection = outputCollection;
		if (outputElement) attrs.outputElement = outputElement;
		if (activeElementsCollection) attrs.activeElementsCollection = activeElementsCollection;
		elements.push({ name: "zeebe:adHoc", attributes: attrs, children: [] });
	}

	if (extensions.unknownElements) {
		elements.push(...extensions.unknownElements);
	}

	return elements;
}
