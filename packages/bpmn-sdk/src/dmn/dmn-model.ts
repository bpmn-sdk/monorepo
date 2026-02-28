import type { XmlElement } from "../types/xml-element.js";

/** DMN hit policy for decision tables. */
export type HitPolicy =
	| "UNIQUE"
	| "FIRST"
	| "ANY"
	| "COLLECT"
	| "RULE ORDER"
	| "OUTPUT ORDER"
	| "PRIORITY";

/** DMN collect aggregation for COLLECT hit policy. */
export type DmnAggregation = "SUM" | "MIN" | "MAX" | "COUNT";

/** DMN type reference for inputs/outputs. */
export type DmnTypeRef = "string" | "boolean" | "number" | "date";

/** A single input column in a decision table. */
export interface DmnInput {
	id: string;
	label?: string;
	inputExpression: {
		id: string;
		typeRef?: DmnTypeRef;
		text?: string;
	};
}

/** A single output column in a decision table. */
export interface DmnOutput {
	id: string;
	label?: string;
	name?: string;
	typeRef?: DmnTypeRef;
}

/** An input entry (unary test) within a rule. */
export interface DmnInputEntry {
	id: string;
	text: string;
}

/** An output entry (literal expression) within a rule. */
export interface DmnOutputEntry {
	id: string;
	text: string;
}

/** A single rule (row) in a decision table. */
export interface DmnRule {
	id: string;
	description?: string;
	inputEntries: DmnInputEntry[];
	outputEntries: DmnOutputEntry[];
}

/** A decision table within a decision element. */
export interface DmnDecisionTable {
	id: string;
	hitPolicy?: HitPolicy;
	aggregation?: DmnAggregation;
	inputs: DmnInput[];
	outputs: DmnOutput[];
	rules: DmnRule[];
}

/** A top-level decision element. */
export interface DmnDecision {
	id: string;
	name?: string;
	decisionTable: DmnDecisionTable;
	extensionElements?: XmlElement[];
}

/** DMN diagram shape for visual representation. */
export interface DmnDiagramShape {
	dmnElementRef: string;
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

/** DMN diagram information. */
export interface DmnDiagram {
	shapes: DmnDiagramShape[];
}

/** Root DMN definitions element. */
export interface DmnDefinitions {
	id: string;
	name: string;
	namespace: string;
	exporter?: string;
	exporterVersion?: string;
	/** Namespace declarations from the XML document (prefix → URI). */
	namespaces: Record<string, string>;
	/** Modeler extension attributes (e.g. executionPlatform). */
	modelerAttributes: Record<string, string>;
	decisions: DmnDecision[];
	diagram?: DmnDiagram;
	extensionElements?: XmlElement[];
}
