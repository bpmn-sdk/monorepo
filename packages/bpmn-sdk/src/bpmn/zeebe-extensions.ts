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

/** Collected Zeebe extensions on a service task. */
export interface ZeebeExtensions {
	taskDefinition?: ZeebeTaskDefinition;
	ioMapping?: ZeebeIoMapping;
	taskHeaders?: ZeebeTaskHeaders;
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

	if (extensions.unknownElements) {
		elements.push(...extensions.unknownElements);
	}

	return elements;
}
