import { DecisionTableBuilder } from "./dmn-builder.js";
import type { DmnDefinitions } from "./dmn-model.js";
import { parseDmn } from "./dmn-parser.js";
import { serializeDmn } from "./dmn-serializer.js";

/** Entry point for DMN decision table operations. */
export const Dmn = {
	/** Create a new DMN decision table using the fluent builder API. */
	createDecisionTable(decisionId: string): DecisionTableBuilder {
		return new DecisionTableBuilder(decisionId);
	},

	/** Parse a DMN XML string into a typed model. */
	parse(xml: string): DmnDefinitions {
		return parseDmn(xml);
	},

	/** Export a typed DMN model to XML string. */
	export(definitions: DmnDefinitions): string {
		return serializeDmn(definitions);
	},
} as const;
