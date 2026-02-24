import type { ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnEditor } from "./editor.js";
import {
	CONTEXTUAL_ADD_TYPES,
	ELEMENT_GROUPS,
	ELEMENT_TYPE_LABELS,
	EXTERNAL_LABEL_TYPES,
	getElementGroup,
	getValidLabelPositions,
} from "./element-groups.js";
import { IC } from "./icons.js";
import type { CreateShapeType, LabelPosition, Tool } from "./types.js";

interface GroupDef {
	id: string;
	title: string;
	groupIcon: string;
	defaultType: CreateShapeType;
	items: Array<{ type: CreateShapeType; icon: string; title: string }>;
}

const GROUP_ICONS: Record<string, string> = {
	events: IC.startEvent,
	activities: IC.task,
	gateways: IC.exclusiveGateway,
};

const GROUPS: GroupDef[] = ELEMENT_GROUPS.map((g) => ({
	...g,
	groupIcon: GROUP_ICONS[g.id] ?? "",
	items: g.types.map((type) => ({
		type,
		icon: (IC as Record<CreateShapeType, string>)[type],
		title: ELEMENT_TYPE_LABELS[type],
	})),
}));

const CTX_OPTIONS = CONTEXTUAL_ADD_TYPES.map((type) => ({
	type,
	icon: (IC as Record<CreateShapeType, string>)[type],
	title: `Add ${ELEMENT_TYPE_LABELS[type]}`,
}));

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

export function initEditorHud(editor: BpmnEditor): void {
	// ── DOM refs ───────────────────────────────────────────────────────────────

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

	// ── Closure state ──────────────────────────────────────────────────────────

	let currentScale = 1;
	let selectedIds: string[] = [];
	let ctxSourceId: string | null = null;
	let openGroupPicker: HTMLElement | null = null;
	let openDropdown: HTMLElement | null = null;
	let zoomOpen = false;

	const groupActiveType: Record<string, CreateShapeType> = {
		events: "startEvent",
		activities: "serviceTask",
		gateways: "exclusiveGateway",
	};

	const groupBtns: Record<string, HTMLButtonElement> = {};

	// ── Static button icons ────────────────────────────────────────────────────

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

	// ── Group picker ───────────────────────────────────────────────────────────

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

		const rect = anchor.getBoundingClientRect();
		const pickerW = group.items.length * 36 + 80;
		const left = Math.max(
			4,
			Math.min(rect.left + rect.width / 2 - pickerW / 2, window.innerWidth - pickerW - 4),
		);
		picker.style.bottom = `${window.innerHeight - rect.top + 6}px`;
		picker.style.left = `${left}px`;

		const onOutside = (e: PointerEvent) => {
			if (!picker.contains(e.target as Node) && e.target !== anchor) {
				closeGroupPicker();
				document.removeEventListener("pointerdown", onOutside);
			}
		};
		setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
	}

	// ── Build group buttons ────────────────────────────────────────────────────

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

		btn.addEventListener("contextmenu", (e) => e.preventDefault());

		toolGroupsEl.appendChild(btn);
		groupBtns[group.id] = btn;

		updateGroupButton(group.id);
	}

	// ── Tool active state ──────────────────────────────────────────────────────

	function updateToolActiveState(tool: Tool): void {
		btnSelect.classList.toggle("active", tool === "select");
		btnPan.classList.toggle("active", tool === "pan");
		btnSpace.classList.toggle("active", tool === "space");

		for (const group of GROUPS) {
			const btn = groupBtns[group.id];
			if (!btn) continue;
			const isGroupActive = group.items.some((item) => tool === `create:${item.type}`);
			btn.classList.toggle("active", isGroupActive);

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

	// ── Dropdown management ────────────────────────────────────────────────────

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

	// ── Zoom widget ────────────────────────────────────────────────────────────

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

	btnZoomCurrent.addEventListener("click", toggleZoomWidget);
	btnZoomOut.addEventListener("click", () => editor.zoomOut());
	btnZoomIn.addEventListener("click", () => editor.zoomIn());

	btnZoomPct.addEventListener("click", (e) => {
		e.stopPropagation();
		buildZoomMenu();
		showDropdown(zoomMenuEl, btnZoomPct, "above");
	});

	// ── More actions menu ──────────────────────────────────────────────────────

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

	// ── Action bar ─────────────────────────────────────────────────────────────

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

	// ── Label position menu ────────────────────────────────────────────────────

	function buildLabelPosMenu(sourceId: string, sourceType: string): void {
		labelPosMenuEl.innerHTML = "";
		for (const pos of getValidLabelPositions(sourceType as CreateShapeType)) {
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

	// ── Contextual quick-add toolbar ───────────────────────────────────────────

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

	// ── Configure toolbar ──────────────────────────────────────────────────────

	function buildCfgToolbar(sourceId: string, sourceType: string): void {
		cfgToolbar.innerHTML = "";

		const eGroup = getElementGroup(sourceType as CreateShapeType);
		const group = eGroup ? GROUPS.find((g) => g.id === eGroup.id) : undefined;

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

		if (EXTERNAL_LABEL_TYPES.has(sourceType as CreateShapeType)) {
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

	// ── Editor event subscriptions ─────────────────────────────────────────────

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

	editor.on("editor:tool", (tool: Tool) => {
		updateToolActiveState(tool);
	});

	// ── Keyboard shortcut: Ctrl+D to duplicate ─────────────────────────────────

	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "d") {
			e.preventDefault();
			editor.duplicate();
		}
	});

	// ── Close zoom widget on outside click ─────────────────────────────────────

	document.addEventListener("pointerdown", (e) => {
		const bottomLeft = document.getElementById("hud-bottom-left");
		if (zoomOpen && bottomLeft && !bottomLeft.contains(e.target as Node)) {
			toggleZoomWidget();
		}
	});
}
