import { BpmnEditor } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task1" name="Process Order">
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
        <di:waypoint x="188" y="220"/>
        <di:waypoint x="260" y="220"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="360" y="220"/>
        <di:waypoint x="432" y="220"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const container = document.getElementById("editor-container");
if (!container) throw new Error("missing #editor-container");

const editor = new BpmnEditor({
	container,
	xml: SAMPLE_XML,
	theme: "dark",
	grid: true,
	fit: "contain",
});

// ── Toolbar wiring ────────────────────────────────────────────────────────────

const toolButtons: Array<[string, Tool]> = [
	["btn-select", "select"],
	["btn-pan", "pan"],
	["btn-start", "create:startEvent"],
	["btn-end", "create:endEvent"],
	["btn-service", "create:serviceTask"],
	["btn-user", "create:userTask"],
	["btn-xgw", "create:exclusiveGateway"],
	["btn-pgw", "create:parallelGateway"],
];

const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
const btnFit = document.getElementById("btn-fit") as HTMLButtonElement;

function setActiveToolBtn(tool: Tool): void {
	for (const [id, t] of toolButtons) {
		const el = document.getElementById(id);
		if (el) el.classList.toggle("active", t === tool);
	}
}

function updateUndoRedo(): void {
	btnUndo.disabled = !editor.canUndo();
	btnRedo.disabled = !editor.canRedo();
}

for (const [id, tool] of toolButtons) {
	const btn = document.getElementById(id);
	btn?.addEventListener("click", () => editor.setTool(tool));
}

btnUndo.addEventListener("click", () => editor.undo());
btnRedo.addEventListener("click", () => editor.redo());
btnFit.addEventListener("click", () => editor.fitView());

editor.on("editor:tool", (tool) => setActiveToolBtn(tool));
editor.on("diagram:change", () => updateUndoRedo());
