import type { ViewportState } from "@bpmn-sdk/canvas";
import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
import { BpmnEditor } from "@bpmn-sdk/editor";
import type { CreateShapeType, LabelPosition, Tool } from "@bpmn-sdk/editor";

// ── SVG icon strings ──────────────────────────────────────────────────────────

const IC = {
	// ── Navigation tools ───────────────────────────────────────────────────
	select: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2 3 12.5 5.5 9.5 7.5 14 9.5 13.2 7.5 8.8 12 8.8z"/></svg>`,
	hand: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 2v6M11.5 3v5M14 5.5V8.5a5.5 5.5 0 01-11 0V5a1.5 1.5 0 013 0v3"/></svg>`,

	// ── History (U-shape curved arrows) ────────────────────────────────────
	undo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4H9.5a4.5 4.5 0 0 1 0 9H5"/><polyline points="8,1.5 5,4 8,6.5"/></svg>`,
	redo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6.5a4.5 4.5 0 0 0 0 9H11"/><polyline points="8,1.5 11,4 8,6.5"/></svg>`,

	// ── Edit actions ────────────────────────────────────────────────────────
	trash: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="4" x2="13" y2="4"/><path d="M5.5 4V2.5h5V4M5 4l.5 9.5h5.1L11 4"/><line x1="6.5" y1="7" x2="6.5" y2="11.5"/><line x1="9.5" y1="7" x2="9.5" y2="11.5"/></svg>`,
	duplicate: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M4 10.5V3.5A1.5 1.5 0 0 1 5.5 2H12"/></svg>`,
	dots: `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>`,
	arrow: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="11" y2="8"/><polyline points="8,5 12,8 8,11"/></svg>`,
	labelPos: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><line x1="8" y1="2" x2="8" y2="5.5"/><line x1="8" y1="10.5" x2="8" y2="14"/><line x1="2" y1="8" x2="5.5" y2="8"/><line x1="10.5" y1="8" x2="14" y2="8"/></svg>`,
	zoomIn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
	zoomOut: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>`,

	// ── Space tool (two vertical bars with outward arrows) ─────────────────
	space: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="2.5" height="8" rx="0.8"/><rect x="12.5" y="4" width="2.5" height="8" rx="0.8"/><path d="M4 8h8"/><path d="M5.5 6.5 4 8 5.5 9.5"/><path d="M10.5 6.5 12 8 10.5 9.5"/></svg>`,

	// ── BPMN Events (circles: thin=start, thick=end) ────────────────────────
	startEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6.5"/></svg>`,
	endEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/></svg>`,

	// ── BPMN Activities (rounded rect + type marker top-left) ──────────────
	// Generic task: plain rect (used as group representative)
	task: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/></svg>`,
	// Service Task: gear marker
	serviceTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="6" r="2.2" stroke-width="1.1"/><circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none"/><path d="M4 3.5v1M4 7.5v1M1.5 6h1M5.5 6h1" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	// User Task: person marker
	userTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="5.5" r="1.5" stroke-width="1.1"/><path d="M1 10Q1 7.5 4 7.5Q7 7.5 7 10" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	// Script Task: document/lines marker
	scriptTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="4.5" height="6" rx="0.5" stroke-width="1.1"/><path d="M2 5h2.5M2 6.5h2.5M2 8h1.5" stroke-linecap="round" stroke-width="1"/></svg>`,
	// Send Task: filled envelope marker
	sendTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" fill="currentColor" rx="0.3" stroke-width="1.1"/></svg>`,
	// Receive Task: outlined envelope marker
	receiveTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" rx="0.3" stroke-width="1.1"/><path d="M1 3.5l2.75 2 2.75-2" stroke-width="1.1"/></svg>`,
	// Business Rule Task: table/grid marker
	businessRuleTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="6" height="4.5" stroke-width="1.1"/><path d="M1 5.3h6M3 3.5v4.5" stroke-width="1.1"/></svg>`,

	// ── BPMN Gateways (diamond + type marker) ──────────────────────────────
	// Exclusive Gateway: X marker
	exclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	// Parallel Gateway: + marker
	parallelGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M8 4.5v7M4.5 8h7" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	// Inclusive Gateway: O (circle) marker
	inclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3" stroke-width="1.5"/></svg>`,
	// Event-based Gateway: double circle marker
	eventBasedGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3.5" stroke-width="1"/><circle cx="8" cy="8" r="2" stroke-width="1"/></svg>`,
};

// ── BPMN element groups ───────────────────────────────────────────────────────

interface GroupItem {
	type: CreateShapeType;
	icon: string;
	title: string;
}

interface GroupDef {
	id: string;
	title: string;
	groupIcon: string;
	defaultType: CreateShapeType;
	items: GroupItem[];
}

const GROUPS: GroupDef[] = [
	{
		id: "events",
		title: "Events",
		groupIcon: IC.startEvent,
		defaultType: "startEvent",
		items: [
			{ type: "startEvent", icon: IC.startEvent, title: "Start Event" },
			{ type: "endEvent", icon: IC.endEvent, title: "End Event" },
		],
	},
	{
		id: "activities",
		title: "Activities",
		groupIcon: IC.task,
		defaultType: "serviceTask",
		items: [
			{ type: "serviceTask", icon: IC.serviceTask, title: "Service Task" },
			{ type: "userTask", icon: IC.userTask, title: "User Task" },
			{ type: "scriptTask", icon: IC.scriptTask, title: "Script Task" },
			{ type: "sendTask", icon: IC.sendTask, title: "Send Task" },
			{ type: "receiveTask", icon: IC.receiveTask, title: "Receive Task" },
			{ type: "businessRuleTask", icon: IC.businessRuleTask, title: "Business Rule Task" },
		],
	},
	{
		id: "gateways",
		title: "Gateways",
		groupIcon: IC.exclusiveGateway,
		defaultType: "exclusiveGateway",
		items: [
			{ type: "exclusiveGateway", icon: IC.exclusiveGateway, title: "Exclusive Gateway" },
			{ type: "parallelGateway", icon: IC.parallelGateway, title: "Parallel Gateway" },
			{ type: "inclusiveGateway", icon: IC.inclusiveGateway, title: "Inclusive Gateway" },
			{ type: "eventBasedGateway", icon: IC.eventBasedGateway, title: "Event-based Gateway" },
		],
	},
];

// Map from CreateShapeType → which group it belongs to
const TYPE_TO_GROUP = new Map<CreateShapeType, GroupDef>();
for (const group of GROUPS) {
	for (const item of group.items) {
		TYPE_TO_GROUP.set(item.type, group);
	}
}

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

let currentScale = 1;
let selectedIds: string[] = [];
let ctxSourceId: string | null = null;

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

const editor = new BpmnEditor({
	container: editorContainer,
	xml: SAMPLE_XML,
	theme: "dark",
	grid: true,
	fit: "center",
	plugins: [createMainMenuPlugin({ title: "BPMN SDK" }), createZoomControlsPlugin()],
});

// ── DOM refs ──────────────────────────────────────────────────────────────────

const btnSelect = document.getElementById("btn-select") as HTMLButtonElement;
const btnPan = document.getElementById("btn-pan") as HTMLButtonElement;
const btnSpace = document.getElementById("btn-space") as HTMLButtonElement;
const toolGroupsEl = document.getElementById("tool-groups") as HTMLDivElement;
const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
const btnDelete = document.getElementById("btn-delete") as HTMLButtonElement;
const btnDuplicate = document.getElementById("btn-duplicate") as HTMLButtonElement;
const btnTopMore = document.getElementById("btn-top-more") as HTMLButtonElement;
const btnZoomCurrent = document.getElementById("btn-zoom-current") as HTMLButtonElement;
const btnZoomOut = document.getElementById("btn-zoom-out") as HTMLButtonElement;
const btnZoomPct = document.getElementById("btn-zoom-pct") as HTMLButtonElement;
const btnZoomIn = document.getElementById("btn-zoom-in") as HTMLButtonElement;
const zoomExpanded = document.getElementById("zoom-expanded") as HTMLDivElement;
const cfgToolbar = document.getElementById("cfg-toolbar") as HTMLDivElement;
const ctxToolbar = document.getElementById("ctx-toolbar") as HTMLDivElement;
const zoomMenuEl = document.getElementById("zoom-menu") as HTMLDivElement;
const moreMenuEl = document.getElementById("more-menu") as HTMLDivElement;
const labelPosMenuEl = document.getElementById("label-pos-menu") as HTMLDivElement;

// ── Static button icons ───────────────────────────────────────────────────────

btnSelect.innerHTML = IC.select;
btnPan.innerHTML = IC.hand;
btnSpace.innerHTML = IC.space;
btnUndo.innerHTML = IC.undo;
btnRedo.innerHTML = IC.redo;
btnDelete.innerHTML = IC.trash;
btnDuplicate.innerHTML = IC.duplicate;
btnTopMore.innerHTML = IC.dots;
btnZoomOut.innerHTML = IC.zoomOut;
btnZoomIn.innerHTML = IC.zoomIn;

// ── Group button state ────────────────────────────────────────────────────────

// Tracks the currently selected type for each group
const groupActiveType: Record<string, CreateShapeType> = {
	events: "startEvent",
	activities: "serviceTask",
	gateways: "exclusiveGateway",
};

// Tracks the DOM button for each group
const groupBtns: Record<string, HTMLButtonElement> = {};

// Currently open group picker (floating panel)
let openGroupPicker: HTMLElement | null = null;

function closeGroupPicker(): void {
	openGroupPicker?.remove();
	openGroupPicker = null;
}

function updateGroupButton(groupId: string): void {
	const btn = groupBtns[groupId];
	const group = GROUPS.find((g) => g.id === groupId);
	if (!btn || !group) return;
	const item = group.items.find((i) => i.type === groupActiveType[groupId]);
	btn.innerHTML = item ? item.icon : group.groupIcon;
}

function showGroupPicker(anchor: HTMLButtonElement, group: GroupDef): void {
	closeGroupPicker();
	closeAllDropdowns();

	const picker = document.createElement("div");
	picker.className = "group-picker";

	const label = document.createElement("span");
	label.className = "group-picker-label";
	label.textContent = group.title;
	picker.appendChild(label);

	for (const item of group.items) {
		const btn = document.createElement("button");
		btn.className = item.type === groupActiveType[group.id] ? "hud-btn active" : "hud-btn";
		btn.innerHTML = item.icon;
		btn.title = item.title;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			groupActiveType[group.id] = item.type;
			updateGroupButton(group.id);
			editor.setTool(`create:${item.type}`);
			closeGroupPicker();
		});
		picker.appendChild(btn);
	}

	document.body.appendChild(picker);
	openGroupPicker = picker;

	// Position above the anchor button
	const rect = anchor.getBoundingClientRect();
	const pickerW = group.items.length * 36 + 80; // approximate
	const left = Math.max(
		4,
		Math.min(rect.left + rect.width / 2 - pickerW / 2, window.innerWidth - pickerW - 4),
	);
	picker.style.bottom = `${window.innerHeight - rect.top + 6}px`;
	picker.style.left = `${left}px`;

	// Close on outside pointer down
	const onOutside = (e: PointerEvent) => {
		if (!picker.contains(e.target as Node) && e.target !== anchor) {
			closeGroupPicker();
			document.removeEventListener("pointerdown", onOutside);
		}
	};
	setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
}

// ── Build group buttons ───────────────────────────────────────────────────────

for (const group of GROUPS) {
	const btn = document.createElement("button");
	btn.className = "hud-btn";
	btn.dataset.group = group.id;
	btn.innerHTML = group.groupIcon;
	btn.title = `${group.title} (hold for options)`;

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPress = false;

	btn.addEventListener("pointerdown", (e) => {
		if (e.button !== 0) return;
		isLongPress = false;
		longPressTimer = setTimeout(() => {
			isLongPress = true;
			showGroupPicker(btn, group);
		}, 500);
	});

	btn.addEventListener("pointerup", () => {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		if (!isLongPress) {
			const activeType = groupActiveType[group.id];
			if (activeType) editor.setTool(`create:${activeType}`);
		}
	});

	btn.addEventListener("pointercancel", () => {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	});

	// Prevent context menu on long press (mobile)
	btn.addEventListener("contextmenu", (e) => e.preventDefault());

	toolGroupsEl.appendChild(btn);
	groupBtns[group.id] = btn;

	// Set the correct icon for the default type
	updateGroupButton(group.id);
}

// ── Tool active state ─────────────────────────────────────────────────────────

function updateToolActiveState(tool: Tool): void {
	btnSelect.classList.toggle("active", tool === "select");
	btnPan.classList.toggle("active", tool === "pan");
	btnSpace.classList.toggle("active", tool === "space");

	for (const group of GROUPS) {
		const btn = groupBtns[group.id];
		if (!btn) continue;
		const isGroupActive = group.items.some((item) => tool === `create:${item.type}`);
		btn.classList.toggle("active", isGroupActive);

		// If a specific type from this group was activated, update the group's icon
		if (isGroupActive) {
			const activeItem = group.items.find((item) => tool === `create:${item.type}`);
			if (activeItem) {
				groupActiveType[group.id] = activeItem.type;
				updateGroupButton(group.id);
			}
		}
	}
}

btnSelect.addEventListener("click", () => editor.setTool("select"));
btnPan.addEventListener("click", () => editor.setTool("pan"));
btnSpace.addEventListener("click", () => editor.setTool("space"));

editor.on("editor:tool", (tool: Tool) => {
	updateToolActiveState(tool);
});

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
	closeGroupPicker();
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

// ── Contextual quick-add toolbar ──────────────────────────────────────────────

const CTX_OPTIONS: Array<{ type: CreateShapeType; icon: string; title: string }> = [
	{ type: "serviceTask", icon: IC.serviceTask, title: "Add Service Task" },
	{ type: "exclusiveGateway", icon: IC.exclusiveGateway, title: "Add Gateway" },
	{ type: "endEvent", icon: IC.endEvent, title: "Add End Event" },
];

const EXTERNAL_LABEL_TYPES = new Set([
	"startEvent",
	"endEvent",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
]);

const POSITION_LABELS: Record<LabelPosition, string> = {
	bottom: "Below (centered)",
	top: "Above (centered)",
	left: "Left",
	right: "Right",
	"bottom-left": "Bottom left",
	"bottom-right": "Bottom right",
	"top-left": "Top left",
	"top-right": "Top right",
};

function getPositionsForType(type: string): LabelPosition[] {
	const base: LabelPosition[] = ["bottom", "top", "left", "right"];
	if (
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway"
	) {
		return [...base, "bottom-left", "bottom-right", "top-left", "top-right"];
	}
	return base;
}

function buildLabelPosMenu(sourceId: string, sourceType: string): void {
	labelPosMenuEl.innerHTML = "";
	for (const pos of getPositionsForType(sourceType)) {
		const btn = document.createElement("button");
		btn.className = "drop-item";
		btn.textContent = POSITION_LABELS[pos];
		btn.addEventListener("click", () => {
			editor.setLabelPosition(sourceId, pos);
			closeAllDropdowns();
		});
		labelPosMenuEl.appendChild(btn);
	}
}

function buildCtxToolbar(sourceId: string, sourceType: string): void {
	ctxToolbar.innerHTML = "";
	const canAddElements = sourceType !== "endEvent";

	if (canAddElements) {
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
				(sourceType === "exclusiveGateway" ||
					sourceType === "parallelGateway" ||
					sourceType === "inclusiveGateway" ||
					sourceType === "eventBasedGateway") &&
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
}

// ── Configure toolbar (above selection): all types in the same group ──────────

function buildCfgToolbar(sourceId: string, sourceType: string): void {
	cfgToolbar.innerHTML = "";

	const group = TYPE_TO_GROUP.get(sourceType as CreateShapeType);

	if (group && group.items.length > 1) {
		for (const opt of group.items) {
			const btn = document.createElement("button");
			btn.className = opt.type === sourceType ? "hud-btn active" : "hud-btn";
			btn.innerHTML = opt.icon;
			btn.title = opt.title;
			btn.addEventListener("click", () => {
				if (opt.type !== sourceType) {
					editor.changeElementType(sourceId, opt.type);
				}
			});
			cfgToolbar.appendChild(btn);
		}
	}

	if (EXTERNAL_LABEL_TYPES.has(sourceType)) {
		if (cfgToolbar.children.length > 0) {
			const sep = document.createElement("div");
			sep.className = "hud-sep";
			cfgToolbar.appendChild(sep);
		}
		const labelBtn = document.createElement("button");
		labelBtn.className = "hud-btn";
		labelBtn.innerHTML = IC.labelPos;
		labelBtn.title = "Label position";
		labelBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			buildLabelPosMenu(sourceId, sourceType);
			showDropdown(labelPosMenuEl, labelBtn, "above");
		});
		cfgToolbar.appendChild(labelBtn);
	}
}

function positionCfgToolbar(): void {
	if (!ctxSourceId) {
		cfgToolbar.style.display = "none";
		return;
	}
	const bounds = editor.getShapeBounds(ctxSourceId);
	if (!bounds) {
		cfgToolbar.style.display = "none";
		return;
	}
	const cx = bounds.x + bounds.width / 2;
	cfgToolbar.style.left = `${cx}px`;
	cfgToolbar.style.top = `${bounds.y - 10}px`;
	cfgToolbar.style.display = cfgToolbar.children.length > 0 ? "flex" : "none";
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
	buildCfgToolbar(id, elemType);
	positionCtxToolbar();
	positionCfgToolbar();
}

function hideCtxToolbar(): void {
	ctxSourceId = null;
	ctxToolbar.style.display = "none";
	cfgToolbar.style.display = "none";
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
		if (elemType) {
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
	positionCfgToolbar();
});

editor.on("diagram:change", () => {
	updateActionBar();
	if (ctxSourceId) {
		const elemType = editor.getElementType(ctxSourceId);
		if (elemType) {
			buildCtxToolbar(ctxSourceId, elemType);
			buildCfgToolbar(ctxSourceId, elemType);
			positionCtxToolbar();
			positionCfgToolbar();
		} else {
			hideCtxToolbar();
		}
	}
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
