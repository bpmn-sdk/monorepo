import { ProcessBuilder } from "./bpmn-builder.js";
import type { BpmnDefinitions } from "./bpmn-model.js";
import { parseBpmn } from "./bpmn-parser.js";
import { serializeBpmn } from "./bpmn-serializer.js";

/** Entry point for BPMN process operations. */
export const Bpmn = {
	/** Create a new BPMN process using the fluent builder API. */
	createProcess(processId: string): ProcessBuilder {
		return new ProcessBuilder(processId);
	},

	/** Parse a BPMN XML string into a typed model. */
	parse(xml: string): BpmnDefinitions {
		return parseBpmn(xml);
	},

	/** Export a typed BPMN model to XML string. */
	export(definitions: BpmnDefinitions): string {
		return serializeBpmn(definitions);
	},
} as const;
