import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
	BpmnAssociation,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "../src/bpmn/bpmn-model.js";
import { parseBpmn } from "../src/bpmn/bpmn-parser.js";
import { serializeBpmn } from "../src/bpmn/bpmn-serializer.js";

const EXAMPLES_DIR = join(__dirname, "../../..", "examples");

const bpmnFiles = readdirSync(EXAMPLES_DIR)
	.filter((f) => f.endsWith(".bpmn"))
	.sort();

// ---------------------------------------------------------------------------
// Deep comparison helpers — compare model structures, not XML strings
// ---------------------------------------------------------------------------

function sortById<T extends { id: string }>(arr: T[]): T[] {
	return [...arr].sort((a, b) => a.id.localeCompare(b.id));
}

function compareFlowElements(a: BpmnFlowElement[], b: BpmnFlowElement[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);

	for (let i = 0; i < sa.length; i++) {
		const ea = sa[i];
		const eb = sb[i];
		expect(ea).toBeDefined();
		expect(eb).toBeDefined();
		if (!ea || !eb) continue;
		expect(ea.type).toBe(eb.type);
		expect(ea.id).toBe(eb.id);
		expect(ea.name).toBe(eb.name);
		expect([...ea.incoming].sort()).toEqual([...eb.incoming].sort());
		expect([...ea.outgoing].sort()).toEqual([...eb.outgoing].sort());
		expect(ea.extensionElements.length).toBe(eb.extensionElements.length);

		if (ea.type === "adHocSubProcess" && eb.type === "adHocSubProcess") {
			compareFlowElements(ea.flowElements, eb.flowElements);
			compareSequenceFlows(ea.sequenceFlows, eb.sequenceFlows);
		}
		if (ea.type === "subProcess" && eb.type === "subProcess") {
			compareFlowElements(ea.flowElements, eb.flowElements);
			compareSequenceFlows(ea.sequenceFlows, eb.sequenceFlows);
		}
	}
}

function compareSequenceFlows(a: BpmnSequenceFlow[], b: BpmnSequenceFlow[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);

	for (let i = 0; i < sa.length; i++) {
		const fa = sa[i];
		const fb = sb[i];
		expect(fa).toBeDefined();
		expect(fb).toBeDefined();
		if (!fa || !fb) continue;
		expect(fa.id).toBe(fb.id);
		expect(fa.sourceRef).toBe(fb.sourceRef);
		expect(fa.targetRef).toBe(fb.targetRef);
		expect(fa.name).toBe(fb.name);
		expect(fa.conditionExpression?.text).toBe(fb.conditionExpression?.text);
	}
}

function compareAnnotations(a: BpmnTextAnnotation[], b: BpmnTextAnnotation[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);
	for (let i = 0; i < sa.length; i++) {
		expect(sa[i]?.id).toBe(sb[i]?.id);
		expect(sa[i]?.text).toBe(sb[i]?.text);
	}
}

function compareAssociations(a: BpmnAssociation[], b: BpmnAssociation[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);
	for (let i = 0; i < sa.length; i++) {
		expect(sa[i]?.id).toBe(sb[i]?.id);
		expect(sa[i]?.sourceRef).toBe(sb[i]?.sourceRef);
		expect(sa[i]?.targetRef).toBe(sb[i]?.targetRef);
	}
}

function compareProcess(a: BpmnProcess, b: BpmnProcess): void {
	expect(a.id).toBe(b.id);
	expect(a.name).toBe(b.name);
	expect(a.isExecutable).toBe(b.isExecutable);
	compareFlowElements(a.flowElements, b.flowElements);
	compareSequenceFlows(a.sequenceFlows, b.sequenceFlows);
	compareAnnotations(a.textAnnotations, b.textAnnotations);
	compareAssociations(a.associations, b.associations);
}

function compareDiShapes(a: BpmnDiShape[], b: BpmnDiShape[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);
	for (let i = 0; i < sa.length; i++) {
		expect(sa[i]?.bpmnElement).toBe(sb[i]?.bpmnElement);
		expect(sa[i]?.bounds).toEqual(sb[i]?.bounds);
	}
}

function compareDiEdges(a: BpmnDiEdge[], b: BpmnDiEdge[]): void {
	const sa = sortById(a);
	const sb = sortById(b);
	expect(sa.length).toBe(sb.length);
	for (let i = 0; i < sa.length; i++) {
		expect(sa[i]?.bpmnElement).toBe(sb[i]?.bpmnElement);
		expect(sa[i]?.waypoints).toEqual(sb[i]?.waypoints);
	}
}

function compareDefinitions(a: BpmnDefinitions, b: BpmnDefinitions): void {
	expect(a.id).toBe(b.id);
	expect(a.targetNamespace).toBe(b.targetNamespace);
	expect(a.exporter).toBe(b.exporter);
	expect(a.exporterVersion).toBe(b.exporterVersion);

	// Root elements
	expect(a.errors.length).toBe(b.errors.length);
	expect(a.escalations.length).toBe(b.escalations.length);

	// Collaborations
	expect(a.collaborations.length).toBe(b.collaborations.length);
	for (let i = 0; i < a.collaborations.length; i++) {
		const ca = a.collaborations[i];
		const cb = b.collaborations[i];
		expect(ca).toBeDefined();
		expect(cb).toBeDefined();
		if (!ca || !cb) continue;
		expect(ca.participants.length).toBe(cb.participants.length);
	}

	// Processes
	expect(a.processes.length).toBe(b.processes.length);
	for (let i = 0; i < a.processes.length; i++) {
		const pa = a.processes[i];
		const pb = b.processes[i];
		expect(pa).toBeDefined();
		expect(pb).toBeDefined();
		if (!pa || !pb) continue;
		compareProcess(pa, pb);
	}

	// Diagrams
	expect(a.diagrams.length).toBe(b.diagrams.length);
	for (let i = 0; i < a.diagrams.length; i++) {
		const da = a.diagrams[i];
		const db = b.diagrams[i];
		expect(da).toBeDefined();
		expect(db).toBeDefined();
		if (!da || !db) continue;
		compareDiShapes(da.plane.shapes, db.plane.shapes);
		compareDiEdges(da.plane.edges, db.plane.edges);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BPMN roundtrip", () => {
	it(`found ${bpmnFiles.length} BPMN example files`, () => {
		expect(bpmnFiles.length).toBeGreaterThanOrEqual(30);
	});

	for (const file of bpmnFiles) {
		it(`roundtrips ${file}`, () => {
			const xml = readFileSync(join(EXAMPLES_DIR, file), "utf-8");

			// Parse original
			const modelA = parseBpmn(xml);

			// Serialize back
			const exportedXml = serializeBpmn(modelA);

			// Re-parse
			const modelB = parseBpmn(exportedXml);

			// Compare model structures
			compareDefinitions(modelA, modelB);
		});
	}
});

describe("BPMN parser", () => {
	it("throws on non-definitions root", () => {
		expect(() => parseBpmn("<foo/>")).toThrow("Expected <definitions>");
	});

	it("parses 9-branch exclusive gateway", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const process = model.processes[0];
		expect(process).toBeDefined();
		if (!process) return;

		const gateway = process.flowElements.find(
			(e) => e.type === "exclusiveGateway" && e.id === "Gateway_0pqd380",
		);
		expect(gateway).toBeDefined();
		expect(gateway?.outgoing.length).toBe(9);
	});

	it("parses adHocSubProcess with multiInstanceLoopCharacteristics", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Epic Review Bot.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const process = model.processes.find((p) => p.id === "Process_Epic_Review");
		expect(process).toBeDefined();
		if (!process) return;

		const adHoc = process.flowElements.find((e) => e.type === "adHocSubProcess");
		expect(adHoc).toBeDefined();
		expect(adHoc?.type).toBe("adHocSubProcess");
		if (adHoc?.type === "adHocSubProcess") {
			expect(adHoc?.loopCharacteristics).toBeDefined();
			expect(adHoc?.flowElements.length).toBeGreaterThan(0);
		}
	});

	it("parses errors and escalations as root elements", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Epic Review Bot.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		expect(model.errors.length).toBeGreaterThan(0);
		expect(model.escalations.length).toBeGreaterThan(0);
	});

	it("parses collaboration with participants", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Epic Review Bot.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		expect(model.collaborations.length).toBe(1);
		expect(model.collaborations[0]?.participants.length).toBeGreaterThan(0);
	});

	it("parses timer boundary event", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Handle PDP - New Epic.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const process = model.processes[0];
		expect(process).toBeDefined();
		if (!process) return;

		const timerEvent = process.flowElements.find(
			(e) =>
				e.type === "intermediateCatchEvent" && e.eventDefinitions.some((d) => d.type === "timer"),
		);
		expect(timerEvent).toBeDefined();
	});

	it("parses sequence flow condition expressions", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Handle PDP - Comment.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const process = model.processes[0];
		expect(process).toBeDefined();
		if (!process) return;

		const condFlow = process.sequenceFlows.find((f) => f.conditionExpression);
		expect(condFlow).toBeDefined();
		expect(condFlow?.conditionExpression?.text.length).toBeGreaterThan(0);
	});

	it("preserves namespace declarations", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Get Config from Github.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		expect(model.namespaces.bpmn).toBe("http://www.omg.org/spec/BPMN/20100524/MODEL");
		expect(model.namespaces.zeebe).toBe("http://camunda.org/schema/zeebe/1.0");
	});

	it("preserves DI shapes and edges", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Get Config from Github.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		expect(model.diagrams.length).toBe(1);
		expect(model.diagrams[0]?.plane.shapes.length).toBeGreaterThan(0);
		expect(model.diagrams[0]?.plane.edges.length).toBeGreaterThan(0);
	});
});

describe("BPMN serializer", () => {
	it("produces valid XML declaration", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Get Config from Github.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const exported = serializeBpmn(model);
		expect(exported.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	});

	it("includes namespace declarations", () => {
		const xml = readFileSync(join(EXAMPLES_DIR, "Get Config from Github.bpmn"), "utf-8");
		const model = parseBpmn(xml);
		const exported = serializeBpmn(model);
		expect(exported).toContain("xmlns:bpmn=");
		expect(exported).toContain("xmlns:zeebe=");
	});
});
