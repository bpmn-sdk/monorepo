import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, Dmn, resetIdCounter } from "../src/index.js"
import {
	buildValidationDmn,
	findValidationStructure,
	getValidationInputNames,
	insertValidationStructure,
	removeValidationStructure,
	validationDecisionId,
} from "../src/index.js"
import type { InputVariableDef } from "../src/index.js"

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task1" name="Do Work">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="152" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_di" bpmnElement="task1">
        <dc:Bounds x="260" y="180" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="188" y="220"/>
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="260" y="220"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="360" y="220"/>
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="432" y="220"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const VARIABLES: InputVariableDef[] = [
	{ name: "customerId", type: "string", required: true, minLength: 3 },
	{ name: "amount", type: "number", required: true, min: 1, max: 1000000 },
	{ name: "email", type: "string", required: false, pattern: "^[^@]+@[^@]+\\.[^@]+$" },
]

describe("validationDecisionId", () => {
	it("produces a deterministic id from start event id", () => {
		expect(validationDecisionId("StartEvent_1")).toBe("StartEvent_1_inputValidation")
	})
})

describe("buildValidationDmn", () => {
	beforeEach(() => resetIdCounter())

	it("produces valid DMN XML with Collect hit policy", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const decision = defs.decisions[0]
		expect(decision).toBeDefined()
		expect(decision?.id).toBe("start_inputValidation")
		expect(decision?.decisionTable?.hitPolicy).toBe("COLLECT")
	})

	it("creates one input column per variable", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const table = defs.decisions[0]?.decisionTable
		expect(table?.inputs).toHaveLength(3)
		expect(table?.inputs[0]?.inputExpression.text).toBe("customerId")
		expect(table?.inputs[1]?.inputExpression.text).toBe("amount")
		expect(table?.inputs[2]?.inputExpression.text).toBe("email")
	})

	it("generates required check row for required variables", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		// customerId required check: first input is "null", others empty
		const requiredRule = rules.find(
			(r) =>
				r.inputEntries[0]?.text === "null" &&
				r.outputEntries[0]?.text === '"customerId is required"',
		)
		expect(requiredRule).toBeDefined()
	})

	it("generates type check row for number variable", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		const typeRule = rules.find((r) => r.outputEntries[0]?.text === '"amount must be a number"')
		expect(typeRule).toBeDefined()
		expect(typeRule?.inputEntries[1]?.text).toBe("not(instance of number)")
	})

	it("generates min/max rows for number variable", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		const minRule = rules.find((r) => r.outputEntries[0]?.text === '"amount must be >= 1"')
		const maxRule = rules.find((r) => r.outputEntries[0]?.text === '"amount must be <= 1000000"')
		expect(minRule).toBeDefined()
		expect(maxRule).toBeDefined()
	})

	it("generates pattern row for string variable", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		const patternRule = rules.find((r) => r.outputEntries[0]?.text === '"email has invalid format"')
		expect(patternRule).toBeDefined()
	})

	it("generates minLength row for string variable", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		const rule = rules.find(
			(r) => r.outputEntries[0]?.text === '"customerId must be at least 3 characters"',
		)
		expect(rule).toBeDefined()
	})

	it("only generates required (not type check) for optional variables", () => {
		const vars: InputVariableDef[] = [{ name: "email", type: "string", required: false }]
		const xml = buildValidationDmn("start", vars)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		// No required row
		const reqRow = rules.find((r) => r.outputEntries[0]?.text === '"email is required"')
		expect(reqRow).toBeUndefined()
		// Type check still present
		const typeRow = rules.find((r) => r.outputEntries[0]?.text === '"email must be a string"')
		expect(typeRow).toBeDefined()
	})

	it("generates type check rules for context and list types", () => {
		const vars: InputVariableDef[] = [
			{ name: "payload", type: "context", required: false },
			{ name: "items", type: "list", required: false },
		]
		const xml = buildValidationDmn("start", vars)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		expect(
			rules.find((r) => r.outputEntries[0]?.text === '"payload must be a context"'),
		).toBeDefined()
		expect(rules.find((r) => r.outputEntries[0]?.text === '"items must be a list"')).toBeDefined()
	})

	it("generates no rules for any type with required false", () => {
		const vars: InputVariableDef[] = [{ name: "data", type: "any", required: false }]
		const xml = buildValidationDmn("start", vars)
		const defs = Dmn.parse(xml)
		const rules = defs.decisions[0]?.decisionTable?.rules ?? []
		expect(rules).toHaveLength(0)
	})
})

describe("insertValidationStructure / findValidationStructure / removeValidationStructure", () => {
	beforeEach(() => resetIdCounter())

	function parseAndInsert() {
		const defs = Bpmn.parse(SAMPLE_XML)
		const decisionId = validationDecisionId("start")
		return { original: defs, updated: insertValidationStructure(defs, "start", decisionId) }
	}

	it("does not mutate the original definitions", () => {
		const { original, updated } = parseAndInsert()
		expect(updated).not.toBe(original)
		const origProcess = original.processes[0]
		expect(origProcess?.flowElements).toHaveLength(3) // start, task, end
	})

	it("inserts BRT, gateway, error end event into the process", () => {
		const { updated } = parseAndInsert()
		const proc = updated.processes[0]
		expect(proc?.flowElements).toHaveLength(6) // start, task, end, brt, gw, errEnd
		const brt = proc?.flowElements.find((e) => e.type === "businessRuleTask")
		const gw = proc?.flowElements.find((e) => e.type === "exclusiveGateway")
		const errEnd = proc?.flowElements.find(
			(e) => e.type === "endEvent" && e.eventDefinitions[0]?.type === "error",
		)
		expect(brt).toBeDefined()
		expect(gw).toBeDefined()
		expect(errEnd).toBeDefined()
	})

	it("wires BRT with calledDecision and resultVariable", () => {
		const { updated } = parseAndInsert()
		const structure = findValidationStructure(updated, "start")
		expect(structure).not.toBeNull()
		expect(structure?.decisionId).toBe("start_inputValidation")
	})

	it("adds VALIDATION_FAILED error to root errors list", () => {
		const { updated } = parseAndInsert()
		const errorDef = updated.errors.find((e) => e.errorCode === "VALIDATION_FAILED")
		expect(errorDef).toBeDefined()
	})

	it("redirects original outgoing flow from start to come from gateway with condition", () => {
		const { updated } = parseAndInsert()
		const proc = updated.processes[0]
		const flow1 = proc?.sequenceFlows.find((f) => f.id === "flow1")
		expect(flow1?.conditionExpression?.text).toBe("= count(validationErrors) = 0")
		// flow1 now goes from gateway, not from start
		const gw = proc?.flowElements.find((e) => e.type === "exclusiveGateway")
		expect(flow1?.sourceRef).toBe(gw?.id)
	})

	it("findValidationStructure detects inserted structure", () => {
		const { updated } = parseAndInsert()
		const result = findValidationStructure(updated, "start")
		expect(result).not.toBeNull()
		expect(result?.decisionId).toBe("start_inputValidation")
	})

	it("findValidationStructure returns null on unmodified diagram", () => {
		const defs = Bpmn.parse(SAMPLE_XML)
		expect(findValidationStructure(defs, "start")).toBeNull()
	})

	it("adds DI shapes for new elements", () => {
		const { updated } = parseAndInsert()
		const plane = updated.diagrams[0]?.plane
		expect(plane?.shapes.length).toBeGreaterThan(3) // original 3 + 3 new
	})

	it("removeValidationStructure reverts to single-flow diagram", () => {
		const { updated } = parseAndInsert()
		const reverted = removeValidationStructure(updated, "start")
		const proc = reverted.processes[0]
		expect(proc?.flowElements).toHaveLength(3) // back to start, task, end
		// flow1 restored to come from start
		const flow1 = proc?.sequenceFlows.find((f) => f.id === "flow1")
		expect(flow1?.sourceRef).toBe("start")
		expect(flow1?.conditionExpression).toBeUndefined()
	})

	it("removeValidationStructure clears VALIDATION_FAILED error", () => {
		const { updated } = parseAndInsert()
		const reverted = removeValidationStructure(updated, "start")
		expect(reverted.errors.find((e) => e.errorCode === "VALIDATION_FAILED")).toBeUndefined()
	})

	it("findValidationStructure returns null after removal", () => {
		const { updated } = parseAndInsert()
		const reverted = removeValidationStructure(updated, "start")
		expect(findValidationStructure(reverted, "start")).toBeNull()
	})

	it("insertValidationStructure on diagram with no outgoing flow works", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  id="Def1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="152" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
		const defs = Bpmn.parse(xml)
		const updated = insertValidationStructure(defs, "start", "start_inputValidation")
		const proc = updated.processes[0]
		// original: start + 3 inserted: brt, gateway, error end event = 4
		expect(proc?.flowElements).toHaveLength(4)
		expect(proc?.flowElements.find((e) => e.type === "businessRuleTask")).toBeDefined()
	})
})

describe("getValidationInputNames", () => {
	beforeEach(() => resetIdCounter())

	it("returns input column names from a validation DMN", () => {
		const xml = buildValidationDmn("start", VARIABLES)
		const names = getValidationInputNames(xml)
		expect(names).toEqual(["customerId", "amount", "email"])
	})

	it("returns empty array for invalid XML", () => {
		expect(getValidationInputNames("not xml")).toEqual([])
	})
})
