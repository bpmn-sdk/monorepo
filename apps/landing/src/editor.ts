import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
import { InMemoryFileResolver, createTabsPlugin } from "@bpmn-sdk/canvas-plugin-tabs";
import { createWatermarkPlugin } from "@bpmn-sdk/canvas-plugin-watermark";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
import { Bpmn, Dmn, Form } from "@bpmn-sdk/core";
import { BpmnEditor, initEditorHud } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";
import { makeExamples } from "./examples.js";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="4" fill="#0062ff"/>
  <circle cx="5" cy="12" r="2.5" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="7.5" y1="12" x2="9" y2="12" stroke="white" stroke-width="1.5"/>
  <rect x="9" y="9.5" width="6" height="5" rx="1" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="15" y1="12" x2="16.5" y2="12" stroke="white" stroke-width="1.5"/>
  <circle cx="19" cy="12" r="2.5" fill="none" stroke="white" stroke-width="2.5"/>
</svg>`;

const IMPORT_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 5l3-3 3 3"/><path d="M2 13h12"/></svg>';

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

// ── Setup ──────────────────────────────────────────────────────────────────────

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

// File resolver — shared between the tabs plugin and the config panel callbacks
const resolver = new InMemoryFileResolver();

// Maps BPMN process IDs to the tab ID that holds that process, for navigation.
const bpmnProcessToTabId = new Map<string, string>();

let editorRef: BpmnEditor | null = null;

// Tabs plugin — onTabActivate loads the BPMN into the editor when a BPMN tab is clicked
// and shows/hides BPMN-specific HUD toolbars for non-BPMN views.
const BPMN_ONLY_HUD = ["hud-top-center", "hud-bottom-left", "hud-bottom-center"];

function setHudVisible(visible: boolean): void {
	for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
		el.style.display = visible ? "" : "none";
	}
	const menuPanel = document.querySelector<HTMLElement>(".bpmn-main-menu-panel");
	if (menuPanel) menuPanel.style.display = visible ? "" : "none";
}

const tabsPlugin = createTabsPlugin({
	resolver,
	// examples getter is called during install(), after tabsPlugin is assigned.
	get examples() {
		return makeExamples(tabsPlugin.api, resolver);
	},
	onNewDiagram() {
		const tabId = tabsPlugin.api.openTab({ type: "bpmn", xml: SAMPLE_XML, name: "New Diagram" });
		for (const proc of Bpmn.parse(SAMPLE_XML).processes) {
			bpmnProcessToTabId.set(proc.id, tabId);
		}
	},
	onImportFiles() {
		fileInput.click();
	},
	onWelcomeShow() {
		setHudVisible(false);
	},
	onTabActivate(_id, config) {
		const isBpmn = config.type === "bpmn";

		// Restore all HUDs and the main menu when any tab is active
		setHudVisible(true);

		if (config.type === "bpmn" && config.xml) {
			editorRef?.load(config.xml);
		}

		// Hide BPMN-only toolbars on non-BPMN views
		for (const hudId of BPMN_ONLY_HUD) {
			const el = document.getElementById(hudId);
			if (el) el.style.display = isBpmn ? "" : "none";
		}

		// Deselect all — closes the config panel and contextual toolbars
		if (!isBpmn) {
			editorRef?.setSelection([]);
		}
	},
	onDownloadTab(config) {
		let content: string;
		let filename: string;
		if (config.type === "bpmn") {
			content = config.xml;
			filename = config.name ?? "diagram.bpmn";
		} else if (config.type === "dmn") {
			content = Dmn.export(config.defs);
			filename = config.name ?? "decision.dmn";
		} else if (config.type === "form") {
			content = Form.export(config.form);
			filename = config.name ?? "form.form";
		} else {
			return; // feel tabs have no file content to download
		}
		const blob = new Blob([content], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	},
});

// ── File import logic ──────────────────────────────────────────────────────────

async function importFiles(files: FileList | File[]): Promise<void> {
	for (const file of Array.from(files)) {
		const name = file.name;
		const ext = name.slice(name.lastIndexOf(".")).toLowerCase();

		try {
			const text = await file.text();

			if (ext === ".bpmn" || ext === ".xml") {
				const bpmnDefs = Bpmn.parse(text);
				const tabId = tabsPlugin.api.openTab({ type: "bpmn", xml: text, name });
				for (const proc of bpmnDefs.processes) {
					bpmnProcessToTabId.set(proc.id, tabId);
				}
			} else if (ext === ".dmn") {
				const defs = Dmn.parse(text);
				resolver.registerDmn(defs);
				tabsPlugin.api.openTab({ type: "dmn", defs, name: defs.name ?? name });
			} else if (ext === ".form" || ext === ".json") {
				const form = Form.parse(text);
				resolver.registerForm(form);
				tabsPlugin.api.openTab({ type: "form", form, name: form.id ?? name });
			}
		} catch (err) {
			console.error(`[bpmn-sdk] Failed to import ${name}:`, err);
		}
	}
}

// ── Hidden file input for the "Import" menu action ────────────────────────────

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.multiple = true;
fileInput.accept = ".bpmn,.xml,.dmn,.form,.json";
fileInput.style.display = "none";
document.body.appendChild(fileInput);
fileInput.addEventListener("change", () => {
	if (fileInput.files) {
		void importFiles(fileInput.files);
		fileInput.value = "";
	}
});

// ── Drag-and-drop ──────────────────────────────────────────────────────────────

editorContainer.addEventListener("dragover", (e) => {
	e.preventDefault();
});

editorContainer.addEventListener("drop", (e) => {
	e.preventDefault();
	const files = e.dataTransfer?.files;
	if (files && files.length > 0) {
		void importFiles(files);
	}
});

// ── Plugins ───────────────────────────────────────────────────────────────────

const palette = createCommandPalettePlugin({
	onZenModeChange(active) {
		for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
			el.style.display = active ? "none" : "";
		}
		editorRef?.setReadOnly(active);
	},
});

const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
	editorRef?.setTool(tool as Tool);
});

const configPanel = createConfigPanelPlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	applyChange: (fn) => {
		editorRef?.applyChange(fn);
	},
});

const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
	openDecision: (decisionId) => tabsPlugin.api.openDecision(decisionId),
	openForm: (formId) => tabsPlugin.api.openForm(formId),
	openProcess: (processId) => {
		const tabId = bpmnProcessToTabId.get(processId);
		if (tabId && tabsPlugin.api.getTabIds().includes(tabId)) {
			tabsPlugin.api.setActiveTab(tabId);
		}
	},
	openFeelPlayground: (expression) => {
		tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression });
	},
});

palette.addCommands([
	{
		id: "feel-playground",
		title: "FEEL Playground",
		action: () => tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
	},
]);

// ── Editor ────────────────────────────────────────────────────────────────────

const editor = new BpmnEditor({
	container: editorContainer,
	xml: SAMPLE_XML,
	theme: "light",
	grid: true,
	fit: "center",
	plugins: [
		createMainMenuPlugin({
			title: "BPMN SDK",
			menuItems: [
				{
					label: "Import files…",
					icon: IMPORT_ICON,
					onClick: () => fileInput.click(),
				},
				{
					label: "FEEL Playground",
					onClick: () => tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
				},
			],
		}),
		createZoomControlsPlugin(),
		createWatermarkPlugin({
			links: [{ label: "Github", url: "https://github.com/bpmn-sdk/monorepo" }],
			logo: LOGO_SVG,
		}),
		tabsPlugin,
		palette,
		paletteEditor,
		configPanel,
		configPanelBpmn,
	],
});
editorRef = editor;

initEditorHud(editor, {
	openProcess: (processId) => {
		const tabId = bpmnProcessToTabId.get(processId);
		if (tabId && tabsPlugin.api.getTabIds().includes(tabId)) {
			tabsPlugin.api.setActiveTab(tabId);
		}
	},
});
