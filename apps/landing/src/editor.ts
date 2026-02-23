import type { ViewportState } from "@bpmn-sdk/canvas";
import { BpmnEditor } from "@bpmn-sdk/editor";
import type { CreateShapeType, Tool } from "@bpmn-sdk/editor";

// ── SVG icon strings ──────────────────────────────────────────────────────────

const IC = {
	select: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2 3 12.5 5.5 9.5 7.5 14 9.5 13.2 7.5 8.8 12 8.8z"/></svg>`,
	hand: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 2v6M11.5 3v5M14 5.5V8.5a5.5 5.5 0 01-11 0V5a1.5 1.5 0 013 0v3"/></svg>`,
	startEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg>`,
	endEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="8" cy="8" r="5"/></svg>`,
	serviceTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="8" r="2.2"/><path d="M8 4.5v1.2M8 10.3v1.2M4.5 8h1.2M10.3 8h1.2" stroke-linecap="round"/></svg>`,
	userTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="6.2" r="1.8"/><path d="M4.5 13c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3" stroke-linecap="round"/></svg>`,
	exclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke-linecap="round"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke-linecap="round"/></svg>`,
	parallelGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><line x1="8" y1="4.5" x2="8" y2="11.5" stroke-linecap="round"/><line x1="4.5" y1="8" x2="11.5" y2="8" stroke-linecap="round"/></svg>`,
	undo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 7.5A5 5 0 1 1 5 3.5"/><polyline points="3,4 3,7.5 6.5,7.5"/></svg>`,
	redo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 7.5A5 5 0 1 0 11 3.5"/><polyline points="13,4 13,7.5 9.5,7.5"/></svg>`,
	trash: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="4" x2="13" y2="4"/><path d="M5.5 4V2.5h5V4M5 4l.5 9.5h5.1L11 4"/><line x1="6.5" y1="7" x2="6.5" y2="11.5"/><line x1="9.5" y1="7" x2="9.5" y2="11.5"/></svg>`,
	duplicate: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M4 10.5V3.5A1.5 1.5 0 0 1 5.5 2H12"/></svg>`,
	dots: `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>`,
	fit: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>`,
	zoomIn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
	zoomOut: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
	check: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5,8 6,11.5 13.5,4.5"/></svg>`,
	moon: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13 9.5a6 6 0 1 1-7.5-7.5 7 7 0 0 0 7.5 7.5z"/></svg>`,
	sun: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.8"/><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/><line x1="3.3" y1="3.3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="12.7" y2="12.7"/><line x1="3.3" y1="12.7" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="12.7" y2="3.3"/></svg>`,
	auto: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 8V3.5"/><path d="M8 8l3.2 2"/></svg>`,
	arrow: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="11" y2="8"/><polyline points="8,5 12,8 8,11"/></svg>`,
};

// ── Sample XML ────────────────────────────────────────────────────────────────

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

// ── Editor init ───────────────────────────────────────────────────────────────

type Theme = "light" | "dark" | "auto";
let currentTheme: Theme = "dark";
let currentScale = 1;
let selectedIds: string[] = [];
let ctxSourceId: string | null = null;

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

const editor = new BpmnEditor({
	container: editorContainer,
	xml: SAMPLE_XML,
	theme: currentTheme,
	grid: true,
	fit: "center",
});

// ── DOM refs ──────────────────────────────────────────────────────────────────

const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
const btnDelete = document.getElementById("btn-delete") as HTMLButtonElement;
const btnDuplicate = document.getElementById("btn-duplicate") as HTMLButtonElement;
const btnTopMore = document.getElementById("btn-top-more") as HTMLButtonElement;
const btnMenu = document.getElementById("btn-menu") as HTMLButtonElement;
const btnZoomCurrent = document.getElementById("btn-zoom-current") as HTMLButtonElement;
const btnZoomOut = document.getElementById("btn-zoom-out") as HTMLButtonElement;
const btnZoomPct = document.getElementById("btn-zoom-pct") as HTMLButtonElement;
const btnZoomIn = document.getElementById("btn-zoom-in") as HTMLButtonElement;
const zoomExpanded = document.getElementById("zoom-expanded") as HTMLDivElement;
const ctxToolbar = document.getElementById("ctx-toolbar") as HTMLDivElement;
const mainMenuEl = document.getElementById("main-menu") as HTMLDivElement;
const zoomMenuEl = document.getElementById("zoom-menu") as HTMLDivElement;
const moreMenuEl = document.getElementById("more-menu") as HTMLDivElement;

// ── Assign icons ──────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
	select: IC.select,
	pan: IC.hand,
	"create:startEvent": IC.startEvent,
	"create:endEvent": IC.endEvent,
	"create:serviceTask": IC.serviceTask,
	"create:userTask": IC.userTask,
	"create:exclusiveGateway": IC.exclusiveGateway,
	"create:parallelGateway": IC.parallelGateway,
};

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
	const t = btn.dataset.tool;
	if (t && TOOL_ICONS[t]) btn.innerHTML = TOOL_ICONS[t];
}

btnUndo.innerHTML = IC.undo;
btnRedo.innerHTML = IC.redo;
btnDelete.innerHTML = IC.trash;
btnDuplicate.innerHTML = IC.duplicate;
btnTopMore.innerHTML = IC.dots;
btnMenu.innerHTML = IC.dots;
btnZoomOut.innerHTML = IC.zoomOut;
btnZoomIn.innerHTML = IC.zoomIn;

// ── Dropdown management ───────────────────────────────────────────────────────

let openDropdown: HTMLElement | null = null;

function showDropdown(
	menu: HTMLElement,
	anchor: HTMLElement,
	align: "right" | "above" = "right",
): void {
	closeAllDropdowns();
	const rect = anchor.getBoundingClientRect();
	if (align === "right") {
		menu.style.top = `${rect.bottom + 6}px`;
		menu.style.right = `${window.innerWidth - rect.right}px`;
		menu.style.left = "auto";
		menu.style.bottom = "auto";
	} else {
		menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
		menu.style.left = `${rect.left}px`;
		menu.style.top = "auto";
		menu.style.right = "auto";
	}
	menu.classList.add("open");
	openDropdown = menu;
}

function closeAllDropdowns(): void {
	openDropdown?.classList.remove("open");
	openDropdown = null;
}

document.addEventListener("pointerdown", (e) => {
	if (openDropdown && !openDropdown.contains(e.target as Node)) {
		closeAllDropdowns();
	}
});

// ── Zoom widget ───────────────────────────────────────────────────────────────

let zoomOpen = false;

function updateZoomDisplay(): void {
	const pct = `${Math.round(currentScale * 100)}%`;
	btnZoomCurrent.textContent = pct;
	btnZoomPct.textContent = `${pct} ▾`;
}

function toggleZoomWidget(): void {
	zoomOpen = !zoomOpen;
	if (zoomOpen) {
		btnZoomCurrent.style.display = "none";
		zoomExpanded.classList.add("open");
	} else {
		zoomExpanded.classList.remove("open");
		btnZoomCurrent.style.display = "";
	}
}

btnZoomCurrent.addEventListener("click", toggleZoomWidget);
btnZoomOut.addEventListener("click", () => editor.zoomOut());
btnZoomIn.addEventListener("click", () => editor.zoomIn());

btnZoomPct.addEventListener("click", (e) => {
	e.stopPropagation();
	buildZoomMenu();
	showDropdown(zoomMenuEl, btnZoomPct, "above");
});

function buildZoomMenu(): void {
	zoomMenuEl.innerHTML = "";
	const items: Array<[string, () => void]> = [
		[
			"Zoom to 100%",
			() => {
				editor.setZoom(1);
				closeAllDropdowns();
			},
		],
		[
			"Zoom to fit",
			() => {
				editor.fitView();
				closeAllDropdowns();
			},
		],
	];
	for (const [label, action] of items) {
		const btn = document.createElement("button");
		btn.className = "drop-item";
		btn.textContent = label;
		btn.addEventListener("click", action);
		zoomMenuEl.appendChild(btn);
	}
}

// ── Main menu ─────────────────────────────────────────────────────────────────

function buildMainMenu(): void {
	mainMenuEl.innerHTML = "";

	const label = document.createElement("div");
	label.className = "drop-label";
	label.textContent = "Theme";
	mainMenuEl.appendChild(label);

	const themes: Array<{ value: Theme; label: string; icon: string }> = [
		{ value: "dark", label: "Dark", icon: IC.moon },
		{ value: "light", label: "Light", icon: IC.sun },
		{ value: "auto", label: "System", icon: IC.auto },
	];

	for (const t of themes) {
		const btn = document.createElement("button");
		btn.className = "drop-item";
		const isActive = t.value === currentTheme;
		btn.innerHTML = `<span class="di-check">${isActive ? IC.check : ""}</span><span class="di-icon">${t.icon}</span><span>${t.label}</span>`;
		btn.addEventListener("click", () => {
			currentTheme = t.value;
			editor.setTheme(t.value);
			buildMainMenu();
		});
		mainMenuEl.appendChild(btn);
	}

	const sep = document.createElement("div");
	sep.className = "drop-sep";
	mainMenuEl.appendChild(sep);

	const fitBtn = document.createElement("button");
	fitBtn.className = "drop-item";
	fitBtn.innerHTML = `<span class="di-check"></span><span class="di-icon">${IC.fit}</span><span>Fit diagram</span>`;
	fitBtn.addEventListener("click", () => {
		editor.fitView();
		closeAllDropdowns();
	});
	mainMenuEl.appendChild(fitBtn);
}

buildMainMenu();

btnMenu.addEventListener("click", (e) => {
	e.stopPropagation();
	buildMainMenu();
	showDropdown(mainMenuEl, btnMenu, "right");
});

// ── More actions menu ─────────────────────────────────────────────────────────

function buildMoreMenu(): void {
	moreMenuEl.innerHTML = "";
	const items: Array<[string, string, () => void]> = [
		[
			"Select all",
			IC.select,
			() => {
				editor.selectAll();
				closeAllDropdowns();
			},
		],
		[
			"Fit diagram",
			IC.fit,
			() => {
				editor.fitView();
				closeAllDropdowns();
			},
		],
	];
	for (const [label, icon, action] of items) {
		const btn = document.createElement("button");
		btn.className = "drop-item";
		btn.innerHTML = `<span class="di-check"></span><span class="di-icon">${icon}</span><span>${label}</span>`;
		btn.addEventListener("click", action);
		moreMenuEl.appendChild(btn);
	}
}

btnTopMore.addEventListener("click", (e) => {
	e.stopPropagation();
	buildMoreMenu();
	showDropdown(moreMenuEl, btnTopMore, "right");
});

// ── Action bar ────────────────────────────────────────────────────────────────

function updateActionBar(): void {
	btnUndo.disabled = !editor.canUndo();
	btnRedo.disabled = !editor.canRedo();
	btnDelete.disabled = selectedIds.length === 0;
	btnDuplicate.disabled = selectedIds.length === 0;
}

updateActionBar();

btnUndo.addEventListener("click", () => editor.undo());
btnRedo.addEventListener("click", () => editor.redo());
btnDelete.addEventListener("click", () => editor.deleteSelected());
btnDuplicate.addEventListener("click", () => editor.duplicate());

// ── Tool bar ──────────────────────────────────────────────────────────────────

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
	btn.addEventListener("click", () => {
		const tool = btn.dataset.tool as Tool;
		if (tool) editor.setTool(tool);
	});
}

editor.on("editor:tool", (tool: Tool) => {
	for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
		btn.classList.toggle("active", btn.dataset.tool === tool);
	}
});

// ── Contextual quick-add toolbar ──────────────────────────────────────────────

const CTX_OPTIONS: Array<{ type: CreateShapeType; icon: string; title: string }> = [
	{ type: "serviceTask", icon: IC.serviceTask, title: "Add Service Task" },
	{ type: "exclusiveGateway", icon: IC.exclusiveGateway, title: "Add Gateway" },
	{ type: "endEvent", icon: IC.endEvent, title: "Add End Event" },
];

function buildCtxToolbar(sourceId: string, sourceType: string): void {
	ctxToolbar.innerHTML = "";
	if (sourceType === "endEvent") return;

	// Arrow: manually draw a connection to any target
	const arrowBtn = document.createElement("button");
	arrowBtn.className = "hud-btn";
	arrowBtn.innerHTML = IC.arrow;
	arrowBtn.title = "Connect to element (click target)";
	arrowBtn.addEventListener("click", () => {
		editor.startConnectionFrom(sourceId);
		hideCtxToolbar();
	});
	ctxToolbar.appendChild(arrowBtn);

	const sep = document.createElement("div");
	sep.className = "hud-sep";
	ctxToolbar.appendChild(sep);

	for (const opt of CTX_OPTIONS) {
		if (
			(sourceType === "exclusiveGateway" || sourceType === "parallelGateway") &&
			opt.type === "exclusiveGateway"
		)
			continue;

		const btn = document.createElement("button");
		btn.className = "hud-btn";
		btn.innerHTML = opt.icon;
		btn.title = opt.title;
		btn.addEventListener("click", () => {
			editor.addConnectedElement(sourceId, opt.type);
			closeAllDropdowns();
		});
		ctxToolbar.appendChild(btn);
	}
}

function positionCtxToolbar(): void {
	if (!ctxSourceId) {
		ctxToolbar.style.display = "none";
		return;
	}
	const bounds = editor.getShapeBounds(ctxSourceId);
	if (!bounds) {
		ctxToolbar.style.display = "none";
		return;
	}
	const cx = bounds.x + bounds.width / 2;
	const top = bounds.y + bounds.height + 10;
	ctxToolbar.style.left = `${cx}px`;
	ctxToolbar.style.top = `${top}px`;
	ctxToolbar.style.display = ctxToolbar.children.length > 0 ? "flex" : "none";
}

function showCtxToolbar(id: string, elemType: string): void {
	ctxSourceId = id;
	buildCtxToolbar(id, elemType);
	positionCtxToolbar();
}

function hideCtxToolbar(): void {
	ctxSourceId = null;
	ctxToolbar.style.display = "none";
}

// ── Editor event handlers ─────────────────────────────────────────────────────

editor.on("editor:select", (ids: string[]) => {
	selectedIds = ids;
	updateActionBar();

	if (ids.length === 1) {
		const id = ids[0];
		if (!id) {
			hideCtxToolbar();
			return;
		}
		const elemType = editor.getElementType(id);
		if (elemType && elemType !== "endEvent") {
			showCtxToolbar(id, elemType);
		} else {
			hideCtxToolbar();
		}
	} else {
		hideCtxToolbar();
	}
});

editor.on("viewport:change", (state: ViewportState) => {
	currentScale = state.scale;
	updateZoomDisplay();
	positionCtxToolbar();
});

editor.on("diagram:change", () => {
	updateActionBar();
	positionCtxToolbar();
});

// Keyboard shortcut: Ctrl+D to duplicate
document.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key === "d") {
		e.preventDefault();
		editor.duplicate();
	}
});

// Close zoom widget on outside click
document.addEventListener("pointerdown", (e) => {
	const bottomLeft = document.getElementById("hud-bottom-left");
	if (zoomOpen && bottomLeft && !bottomLeft.contains(e.target as Node)) {
		toggleZoomWidget();
	}
});
