import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
import { createWatermarkPlugin } from "@bpmn-sdk/canvas-plugin-watermark";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
import { BpmnEditor, initEditorHud } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="4" fill="#0062ff"/>
  <circle cx="5" cy="12" r="2.5" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="7.5" y1="12" x2="9" y2="12" stroke="white" stroke-width="1.5"/>
  <rect x="9" y="9.5" width="6" height="5" rx="1" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="15" y1="12" x2="16.5" y2="12" stroke="white" stroke-width="1.5"/>
  <circle cx="19" cy="12" r="2.5" fill="none" stroke="white" stroke-width="2.5"/>
</svg>`;

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

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

const palette = createCommandPalettePlugin({
	onZenModeChange(active) {
		for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
			el.style.display = active ? "none" : "";
		}
		editorRef?.setReadOnly(active);
	},
});

let editorRef: BpmnEditor | null = null;
const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
	editorRef?.setTool(tool as Tool);
});

const configPanel = createConfigPanelPlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	applyChange: (fn) => {
		editorRef?.applyChange(fn);
	},
});
const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel);

const editor = new BpmnEditor({
	container: editorContainer,
	xml: SAMPLE_XML,
	theme: "light",
	grid: true,
	fit: "center",
	plugins: [
		createMainMenuPlugin({ title: "BPMN SDK" }),
		createZoomControlsPlugin(),
		createWatermarkPlugin({
			links: [{ label: "Github", url: "https://github.com/bpmn-sdk/monorepo" }],
			logo: LOGO_SVG,
		}),
		palette,
		paletteEditor,
		configPanel,
		configPanelBpmn,
	],
});
editorRef = editor;

initEditorHud(editor);
