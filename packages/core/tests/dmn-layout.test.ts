import { describe, expect, it } from "vitest"
import { layoutDmn } from "../src/dmn/dmn-layout.js"
import { Dmn, compactifyDmn, expandDmn } from "../src/index.js"

describe("layoutDmn", () => {
	it("returns definitions unchanged when no DRG elements", () => {
		const defs = Dmn.makeEmpty()
		// strip decisions to test empty case
		const empty = {
			...defs,
			decisions: [],
			inputData: [],
			knowledgeSources: [],
			businessKnowledgeModels: [],
		}
		const result = layoutDmn(empty)
		expect(result).toBe(empty) // same reference — no change
	})

	it("assigns diagram shapes to a single decision", () => {
		const defs = Dmn.makeEmpty()
		const stripped = { ...defs, diagram: undefined }
		const result = layoutDmn(stripped)

		expect(result.diagram).toBeDefined()
		expect(result.diagram?.shapes).toHaveLength(1)
		const shape = result.diagram?.shapes[0]
		if (!shape) throw new Error("Expected shape")
		expect(shape.dmnElementRef).toBe(defs.decisions[0]?.id)
		expect(shape.bounds.width).toBe(180)
		expect(shape.bounds.height).toBe(80)
	})

	it("lays out inputData to the left of a decision that requires it", () => {
		const defs = Dmn.makeEmpty()
		const decisionId = defs.decisions[0]?.id
		if (!decisionId) throw new Error("No decision")

		const inputId = "InputData_1"
		const reqId = "InformationRequirement_1"

		const baseDecision = defs.decisions[0]
		if (!baseDecision) throw new Error("No decision in makeEmpty result")
		const defsWithInput = {
			...defs,
			diagram: undefined,
			inputData: [{ id: inputId, name: "Customer Age" }],
			decisions: [
				{
					...baseDecision,
					informationRequirements: [
						{
							id: reqId,
							requiredInput: inputId,
						},
					],
				},
			],
		}

		const result = layoutDmn(defsWithInput)
		expect(result.diagram?.shapes).toHaveLength(2)
		expect(result.diagram?.edges).toHaveLength(1)

		const inputShape = result.diagram?.shapes.find((s) => s.dmnElementRef === inputId)
		const decisionShape = result.diagram?.shapes.find((s) => s.dmnElementRef === decisionId)
		if (!inputShape || !decisionShape) throw new Error("Missing shapes")

		// inputData (layer 0) should be to the left of decision (layer 1)
		expect(inputShape.bounds.x).toBeLessThan(decisionShape.bounds.x)
	})

	it("edge connects right edge of source to left edge of target", () => {
		const inputId = "InputData_1"
		const decisionId = "Decision_1"
		const reqId = "req_1"

		const defs = {
			...Dmn.makeEmpty(),
			diagram: undefined,
			inputData: [{ id: inputId, name: "Input" }],
			decisions: [
				{
					id: decisionId,
					name: "My Decision",
					informationRequirements: [{ id: reqId, requiredInput: inputId }],
					knowledgeRequirements: [],
					authorityRequirements: [],
				},
			],
		}

		const result = layoutDmn(defs)
		const edge = result.diagram?.edges[0]
		if (!edge) throw new Error("Expected edge")

		const inputShape = result.diagram?.shapes.find((s) => s.dmnElementRef === inputId)
		const decisionShape = result.diagram?.shapes.find((s) => s.dmnElementRef === decisionId)
		if (!inputShape || !decisionShape) throw new Error("Missing shapes")

		// First waypoint at right edge of inputData
		expect(edge.waypoints[0]?.x).toBe(inputShape.bounds.x + inputShape.bounds.width)
		// Second waypoint at left edge of decision
		expect(edge.waypoints[1]?.x).toBe(decisionShape.bounds.x)
	})
})

describe("Dmn.layout", () => {
	it("is exposed on the Dmn namespace", () => {
		const defs = Dmn.makeEmpty()
		const result = Dmn.layout(defs)
		expect(result.diagram).toBeDefined()
	})
})

describe("compactifyDmn / expandDmn", () => {
	it("round-trips a single decision", () => {
		const defs = Dmn.createDecisionTable("Decision_1")
			.name("Approval")
			.input({ label: "Amount", expression: "amount", typeRef: "number" })
			.output({ label: "Approved", name: "approved", typeRef: "boolean" })
			.rule({ inputs: ["> 1000"], outputs: ["false"] })
			.build()

		const compact = compactifyDmn(defs)
		expect(compact.decisions).toHaveLength(1)
		expect(compact.decisions[0]?.name).toBe("Approval")
		expect(compact.decisions[0]?.inputs).toHaveLength(1)
		expect(compact.decisions[0]?.outputs).toHaveLength(1)
		expect(compact.decisions[0]?.rules).toHaveLength(1)
		expect(compact.decisions[0]?.rules[0]?.inputs[0]).toBe("> 1000")
		expect(compact.decisions[0]?.rules[0]?.outputs[0]).toBe("false")
	})

	it("expandDmn produces valid DmnDefinitions with diagram", () => {
		const compact = {
			id: "Defs_1",
			name: "Test",
			decisions: [
				{
					id: "Decision_1",
					name: "My Decision",
					inputs: [{ id: "i1", label: "Status", expression: "status", typeRef: "string" as const }],
					outputs: [{ id: "o1", label: "Result", name: "result", typeRef: "string" as const }],
					rules: [{ id: "r1", inputs: ['"active"'], outputs: ['"approved"'] }],
				},
			],
			inputData: [],
		}

		const result = expandDmn(compact)
		expect(result.decisions).toHaveLength(1)
		expect(result.decisions[0]?.decisionTable).toBeDefined()
		expect(result.diagram).toBeDefined()
		expect(result.diagram?.shapes).toHaveLength(1)
	})

	it("expandDmn wires informationRequirements from requires array", () => {
		const compact = {
			id: "Defs_1",
			name: "Test",
			inputData: [{ id: "id_1", name: "Customer" }],
			decisions: [
				{
					id: "Decision_1",
					name: "Approve",
					inputs: [],
					outputs: [{ id: "o1", label: "Result", name: "result" }],
					rules: [],
					requires: ["id_1"],
				},
			],
		}

		const result = expandDmn(compact)
		const decision = result.decisions[0]
		if (!decision) throw new Error("No decision")
		expect(decision.informationRequirements).toHaveLength(1)
		expect(decision.informationRequirements[0]?.requiredInput).toBe("id_1")
		// Layout: inputData (layer 0) should be left of decision (layer 1)
		const shapes = result.diagram?.shapes ?? []
		const inputShape = shapes.find((s) => s.dmnElementRef === "id_1")
		const decisionShape = shapes.find((s) => s.dmnElementRef === "Decision_1")
		if (!inputShape || !decisionShape) throw new Error("Missing shapes")
		expect(inputShape.bounds.x).toBeLessThan(decisionShape.bounds.x)
	})
})
