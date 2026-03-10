import { generateId } from "../types/id-generator.js"
import { layoutDmn } from "./dmn-layout.js"
import type {
	DmnAggregation,
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnInput,
	DmnInputData,
	DmnOutput,
	DmnRule,
	DmnTypeRef,
	HitPolicy,
} from "./dmn-model.js"

// ── Compact types ─────────────────────────────────────────────────────────────

export interface CompactDmnInput {
	id: string
	label?: string
	expression?: string
	typeRef?: DmnTypeRef
}

export interface CompactDmnOutput {
	id: string
	label?: string
	name?: string
	typeRef?: DmnTypeRef
}

export interface CompactDmnRule {
	id: string
	inputs: string[]
	outputs: string[]
	description?: string
}

export interface CompactDmnDecision {
	id: string
	name?: string
	hitPolicy?: HitPolicy
	aggregation?: DmnAggregation
	inputs: CompactDmnInput[]
	outputs: CompactDmnOutput[]
	rules: CompactDmnRule[]
	/** IDs of decisions or inputData this decision requires */
	requires?: string[]
}

export interface CompactDmn {
	id: string
	name: string
	decisions: CompactDmnDecision[]
	inputData: Array<{ id: string; name?: string }>
}

// ── Compactify ────────────────────────────────────────────────────────────────

/** Convert a DmnDefinitions model to a token-efficient CompactDmn representation. */
export function compactifyDmn(defs: DmnDefinitions): CompactDmn {
	const decisions: CompactDmnDecision[] = defs.decisions.map((d) => {
		const requires: string[] = []
		for (const req of d.informationRequirements) {
			const src = req.requiredDecision ?? req.requiredInput
			if (src) requires.push(src)
		}

		const dt = d.decisionTable
		return {
			id: d.id,
			name: d.name,
			hitPolicy: dt?.hitPolicy,
			aggregation: dt?.aggregation,
			inputs: (dt?.inputs ?? []).map(
				(i): CompactDmnInput => ({
					id: i.id,
					label: i.label,
					expression: i.inputExpression.text,
					typeRef: i.inputExpression.typeRef,
				}),
			),
			outputs: (dt?.outputs ?? []).map(
				(o): CompactDmnOutput => ({
					id: o.id,
					label: o.label,
					name: o.name,
					typeRef: o.typeRef,
				}),
			),
			rules: (dt?.rules ?? []).map(
				(r): CompactDmnRule => ({
					id: r.id,
					inputs: r.inputEntries.map((e) => e.text),
					outputs: r.outputEntries.map((e) => e.text),
					description: r.description,
				}),
			),
			requires: requires.length > 0 ? requires : undefined,
		}
	})

	return {
		id: defs.id,
		name: defs.name,
		decisions,
		inputData: defs.inputData.map((d) => ({ id: d.id, name: d.name })),
	}
}

// ── Expand ────────────────────────────────────────────────────────────────────

/** Convert a CompactDmn back to a full DmnDefinitions model with auto-layout applied. */
export function expandDmn(compact: CompactDmn): DmnDefinitions {
	const inputData: DmnInputData[] = compact.inputData.map((d) => ({ id: d.id, name: d.name }))

	const decisions: DmnDecision[] = compact.decisions.map((cd) => {
		// Build requirement links
		const informationRequirements = (cd.requires ?? []).map((srcId) => ({
			id: generateId("InformationRequirement"),
			requiredDecision: compact.decisions.some((d) => d.id === srcId) ? srcId : undefined,
			requiredInput: compact.inputData.some((d) => d.id === srcId) ? srcId : undefined,
		}))

		// Build decision table
		let decisionTable: DmnDecisionTable | undefined
		if (cd.inputs.length > 0 || cd.outputs.length > 0 || cd.rules.length > 0) {
			const inputs: DmnInput[] = cd.inputs.map((i) => ({
				id: i.id,
				label: i.label,
				inputExpression: {
					id: generateId("inputExpression"),
					typeRef: i.typeRef,
					text: i.expression,
				},
			}))
			const outputs: DmnOutput[] = cd.outputs.map((o) => ({
				id: o.id,
				label: o.label,
				name: o.name,
				typeRef: o.typeRef,
			}))
			const rules: DmnRule[] = cd.rules.map((r) => ({
				id: r.id,
				description: r.description,
				inputEntries: r.inputs.map((text, idx) => ({
					id: generateId(`inputEntry_${idx}`),
					text,
				})),
				outputEntries: r.outputs.map((text, idx) => ({
					id: generateId(`outputEntry_${idx}`),
					text,
				})),
			}))
			decisionTable = {
				id: generateId("decisionTable"),
				hitPolicy: cd.hitPolicy,
				aggregation: cd.aggregation,
				inputs,
				outputs,
				rules,
			}
		}

		return {
			id: cd.id,
			name: cd.name,
			decisionTable,
			informationRequirements,
			knowledgeRequirements: [],
			authorityRequirements: [],
		}
	})

	const defs: DmnDefinitions = {
		id: compact.id,
		name: compact.name,
		namespace: "http://bpmn.io/schema/dmn",
		namespaces: {
			"": "https://www.omg.org/spec/DMN/20191111/MODEL/",
			dmndi: "https://www.omg.org/spec/DMN/20191111/DMNDI/",
			dc: "http://www.omg.org/spec/DMN/20180521/DC/",
		},
		modelerAttributes: {},
		decisions,
		inputData,
		knowledgeSources: [],
		businessKnowledgeModels: [],
		textAnnotations: [],
		associations: [],
	}

	return layoutDmn(defs)
}
