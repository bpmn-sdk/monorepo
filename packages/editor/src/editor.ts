import {
	KeyboardHandler,
	ViewportController,
	computeDiagramBounds,
	createDefs,
	createGrid,
	injectStyles,
	render,
} from "@bpmn-sdk/canvas";
import type {
	CanvasApi,
	CanvasEvents,
	CanvasPlugin,
	FitMode,
	RenderedEdge,
	RenderedShape,
	Theme,
} from "@bpmn-sdk/canvas";
import { Bpmn } from "@bpmn-sdk/core";
import type { BpmnBounds, BpmnDefinitions } from "@bpmn-sdk/core";
import { CommandStack } from "./command-stack.js";
import { injectEditorStyles } from "./css.js";
import {
	closestPort,
	computeWaypoints,
	computeWaypointsWithPorts,
	diagramToScreen,
	labelBoundsForPosition,
	portFromWaypoint,
	screenToDiagram,
} from "./geometry.js";
import { LabelEditor } from "./label-editor.js";
import {
	changeElementType as changeElementTypeFn,
	copyElements,
	createConnection,
	createEmptyDefinitions,
	createShape,
	deleteElements,
	insertShapeOnEdge,
	moveShapes,
	pasteElements,
	resizeShape,
	updateEdgeEndpoint,
	updateLabel,
	updateLabelPosition,
} from "./modeling.js";
import type { Clipboard } from "./modeling.js";
import { OverlayRenderer } from "./overlay.js";
import { canConnect } from "./rules.js";
import { EditorStateMachine } from "./state-machine.js";
import type { Callbacks } from "./state-machine.js";
import { RESIZABLE_TYPES } from "./types.js";
import type {
	CreateShapeType,
	DiagPoint,
	EditorEvents,
	EditorOptions,
	HandleDir,
	HitResult,
	LabelPosition,
	PortDir,
	Tool,
} from "./types.js";

const NS = "http://www.w3.org/2000/svg";
let _instanceCounter = 0;

function defaultBounds(
	type: CreateShapeType,
	cx: number,
	cy: number,
): { x: number; y: number; width: number; height: number } {
	switch (type) {
		case "startEvent":
		case "endEvent":
			return { x: cx - 18, y: cy - 18, width: 36, height: 36 };
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			return { x: cx - 25, y: cy - 25, width: 50, height: 50 };
		default:
			return { x: cx - 50, y: cy - 40, width: 100, height: 80 };
	}
}

/**
 * BpmnEditor — a full BPMN 2.0 diagram editor with create, move, resize,
 * connect, delete, label-edit, undo/redo, and copy/paste.
 */
export class BpmnEditor {
	// ── DOM ────────────────────────────────────────────────────────────
	private readonly _id: string;
	private readonly _host: HTMLElement;
	private readonly _svg: SVGSVGElement;
	private readonly _viewportG: SVGGElement;
	private readonly _edgesG: SVGGElement;
	private readonly _shapesG: SVGGElement;
	private readonly _labelsG: SVGGElement;
	private readonly _overlayG: SVGGElement;
	private _gridPattern: SVGPatternElement | null = null;
	private _markerId = "";

	// ── Sub-systems ────────────────────────────────────────────────────
	private readonly _viewport: ViewportController;
	private readonly _keyboard: KeyboardHandler;
	private readonly _overlay: OverlayRenderer;
	private readonly _commandStack: CommandStack;
	private readonly _stateMachine: EditorStateMachine;
	private readonly _labelEditor: LabelEditor;
	private readonly _plugins: CanvasPlugin[] = [];

	// ── State ──────────────────────────────────────────────────────────
	private _shapes: RenderedShape[] = [];
	private _edges: RenderedEdge[] = [];
	private _defs: BpmnDefinitions | null = null;
	private _selectedIds: string[] = [];
	private _theme: Theme;
	private _fit: FitMode;
	private _clipboard: Clipboard | null = null;
	private _snapDelta: { dx: number; dy: number } | null = null;
	private _selectedEdgeId: string | null = null;
	private _edgeDropTarget: string | null = null;
	private _ghostSnapCenter: DiagPoint | null = null;
	private _createEdgeDropTarget: string | null = null;

	// ── Events ─────────────────────────────────────────────────────────
	private readonly _listeners = new Map<string, Set<(...args: unknown[]) => void>>();

	// ── Resize observer ────────────────────────────────────────────────
	private readonly _ro: ResizeObserver;

	constructor(options: EditorOptions) {
		injectStyles();
		injectEditorStyles();

		this._id = String(_instanceCounter++);
		this._theme = options.theme ?? "auto";
		this._fit = options.fit ?? "contain";

		// ── DOM ──────────────────────────────────────────────────────
		const container = options.container;
		container.innerHTML = "";

		this._host = document.createElement("div");
		this._host.className = "bpmn-canvas-host";
		this._host.setAttribute("role", "application");
		this._host.setAttribute("aria-label", "BPMN Editor");
		this._host.setAttribute("tabindex", "0");
		this._applyTheme(this._theme);
		container.appendChild(this._host);

		this._svg = document.createElementNS(NS, "svg") as SVGSVGElement;
		this._svg.setAttribute("aria-hidden", "true");
		this._host.appendChild(this._svg);

		this._markerId = createDefs(this._svg, this._id);

		if (options.grid !== false) {
			this._gridPattern = createGrid(this._svg, this._id);
		}

		this._viewportG = document.createElementNS(NS, "g") as SVGGElement;
		this._svg.appendChild(this._viewportG);

		this._edgesG = document.createElementNS(NS, "g") as SVGGElement;
		this._shapesG = document.createElementNS(NS, "g") as SVGGElement;
		this._labelsG = document.createElementNS(NS, "g") as SVGGElement;
		this._overlayG = document.createElementNS(NS, "g") as SVGGElement;
		this._viewportG.appendChild(this._edgesG);
		this._viewportG.appendChild(this._shapesG);
		this._viewportG.appendChild(this._labelsG);
		this._viewportG.appendChild(this._overlayG);

		// ── Viewport controller ──────────────────────────────────────
		this._viewport = new ViewportController(
			this._host,
			this._svg,
			this._viewportG,
			this._gridPattern,
			(state) => this._emit("viewport:change", state),
		);

		// ── Overlay ──────────────────────────────────────────────────
		this._overlay = new OverlayRenderer(this._overlayG, this._markerId);

		// ── Command stack ────────────────────────────────────────────
		this._commandStack = new CommandStack();

		// ── State machine callbacks ──────────────────────────────────
		const callbacks: Callbacks = {
			getShapes: () => [...this._shapes],
			getSelectedIds: () => [...this._selectedIds],
			getViewport: () => this._viewport.state,
			viewportDidPan: () => this._viewport.didPan,
			isResizable: (id) => this._isResizable(id),
			lockViewport: (lock) => this._viewport.lock(lock),
			setSelection: (ids) => this._setSelection(ids),
			previewTranslate: (dx, dy) => this._previewTranslate(dx, dy),
			commitTranslate: (dx, dy) => this._commitTranslate(dx, dy),
			cancelTranslate: () => this._cancelTranslate(),
			previewResize: (bounds) => this._overlay.setResizePreview(bounds),
			commitResize: (id, bounds) => {
				this._overlay.setResizePreview(null);
				this._executeCommand((d) => resizeShape(d, id, bounds));
			},
			previewConnect: (ghostEnd) => {
				const src = this._connectSourceBounds();
				if (src) {
					const wps = computeWaypoints(src, {
						x: ghostEnd.x - 1,
						y: ghostEnd.y - 1,
						width: 2,
						height: 2,
					});
					this._overlay.setGhostConnection(wps);
				}
			},
			cancelConnect: () => this._overlay.setGhostConnection(null),
			commitConnect: (srcId, tgtId) => {
				this._overlay.setGhostConnection(null);
				this._doConnect(srcId, tgtId);
			},
			previewRubberBand: (origin, current) => this._overlay.setRubberBand(origin, current),
			cancelRubberBand: () => this._overlay.setRubberBand(null),
			commitCreate: (type, diagPoint) => this._doCreate(type, diagPoint),
			startLabelEdit: (id) => this._startLabelEdit(id),
			setHovered: (id) => this._overlay.setHovered(id, this._shapes),
			executeDelete: (ids) => {
				this._executeCommand((d) => deleteElements(d, ids));
				this._setSelection([]);
			},
			executeCopy: () => this._doCopy(),
			executePaste: () => this._doPaste(),
			setTool: (tool) => this.setTool(tool),
			getSelectedEdgeId: () => this._selectedEdgeId,
			setEdgeSelected: (edgeId) => this._setEdgeSelected(edgeId),
			previewEndpointMove: (edgeId, isStart, diagPoint) =>
				this._previewEndpointMove(edgeId, isStart, diagPoint),
			commitEndpointMove: (edgeId, isStart, diagPoint) =>
				this._commitEndpointMove(edgeId, isStart, diagPoint),
			cancelEndpointMove: () => {
				this._overlay.setEndpointDragGhost(null);
				if (this._selectedEdgeId) {
					const edge = this._edges.find((e) => e.id === this._selectedEdgeId);
					this._overlay.setEdgeEndpoints(edge?.edge.waypoints ?? null, this._selectedEdgeId);
				}
			},
			previewSpace: (origin, current, axis) => this._previewSpace(origin, current, axis),
			commitSpace: (origin, current, axis) => this._commitSpace(origin, current, axis),
			cancelSpace: () => this._cancelSpace(),
		};

		this._stateMachine = new EditorStateMachine(callbacks);

		// ── Label editor ─────────────────────────────────────────────
		this._labelEditor = new LabelEditor(
			this._host,
			(id, text) => {
				this._executeCommand((d) => updateLabel(d, id, text));
				this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
			},
			() => {
				this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
			},
		);

		// ── Keyboard ─────────────────────────────────────────────────
		this._keyboard = new KeyboardHandler(
			this._host,
			this._viewport,
			() => this.fitView(),
			(id) => {
				const shape = this._shapes.find((s) => s.id === id);
				if (shape) {
					this._emit("element:click", id, new PointerEvent("click"));
				}
			},
			(id) => this._emit("element:focus", id),
			() => this._emit("element:blur"),
		);

		this._host.addEventListener("keydown", this._onKeyDown);

		// ── Pointer events ────────────────────────────────────────────
		this._svg.addEventListener("pointerdown", this._onPointerDown);
		this._svg.addEventListener("pointermove", this._onPointerMove);
		this._svg.addEventListener("pointerup", this._onPointerUp);
		this._svg.addEventListener("dblclick", this._onDblClick);

		// ── Plugins ───────────────────────────────────────────────────
		if (options.plugins) {
			for (const plugin of options.plugins) {
				this._installPlugin(plugin);
			}
		}

		// ── Initial diagram ───────────────────────────────────────────
		if (options.xml) {
			this.load(options.xml);
		} else {
			this.loadDefinitions(createEmptyDefinitions());
		}

		this._ro = new ResizeObserver(() => {
			if (this._defs) this.fitView();
		});
		this._ro.observe(this._host);
	}

	// ── Public API ─────────────────────────────────────────────────────

	load(xml: string): void {
		const defs = Bpmn.parse(xml);
		this.loadDefinitions(defs);
	}

	loadDefinitions(defs: BpmnDefinitions): void {
		this._commandStack.clear();
		this._commandStack.push(defs);
		this._selectedIds = [];
		this._renderDefs(defs);
		if (this._fit !== "none") {
			requestAnimationFrame(() => this.fitView());
		}
	}

	exportXml(): string {
		return Bpmn.export(this._defs ?? createEmptyDefinitions());
	}

	setTool(tool: Tool): void {
		this._overlay.setGhostCreate(null);
		this._overlay.setAlignmentGuides([]);
		this._setCreateEdgeDropHighlight(null);
		this._ghostSnapCenter = null;
		if (tool === "select") {
			this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
		} else if (tool === "pan") {
			this._stateMachine.setMode({ mode: "pan" });
		} else if (tool === "space") {
			this._stateMachine.setMode({ mode: "space", sub: { name: "idle" } });
		} else {
			const elementType = tool.slice(7) as CreateShapeType;
			this._stateMachine.setMode({ mode: "create", elementType });
		}
		this._emit("editor:tool", tool);
	}

	setSelection(ids: string[]): void {
		this._setSelection(ids);
	}

	deleteSelected(): void {
		if (this._selectedIds.length === 0) return;
		const ids = [...this._selectedIds];
		this._executeCommand((d) => deleteElements(d, ids));
		this._setSelection([]);
	}

	undo(): void {
		const prev = this._commandStack.undo();
		if (prev) {
			this._renderDefs(prev);
			this._emit("diagram:change", prev);
		}
	}

	redo(): void {
		const next = this._commandStack.redo();
		if (next) {
			this._renderDefs(next);
			this._emit("diagram:change", next);
		}
	}

	canUndo(): boolean {
		return this._commandStack.canUndo();
	}

	canRedo(): boolean {
		return this._commandStack.canRedo();
	}

	fitView(padding = 40): void {
		if (!this._defs) return;
		const bounds = computeDiagramBounds(this._defs);
		if (!bounds) return;
		const svgW = this._svg.clientWidth;
		const svgH = this._svg.clientHeight;
		if (svgW === 0 || svgH === 0) return;
		const dW = bounds.maxX - bounds.minX;
		const dH = bounds.maxY - bounds.minY;
		if (dW === 0 || dH === 0) return;
		const scaleX = (svgW - padding * 2) / dW;
		const scaleY = (svgH - padding * 2) / dH;
		let scale = Math.min(scaleX, scaleY);
		if (this._fit === "center") scale = 1;
		const tx = (svgW - dW * scale) / 2 - bounds.minX * scale;
		const ty = (svgH - dH * scale) / 2 - bounds.minY * scale;
		this._viewport.set({ tx, ty, scale });
	}

	setTheme(theme: Theme): void {
		this._theme = theme;
		this._applyTheme(theme);
	}

	zoomIn(): void {
		const { width, height } = this._svg.getBoundingClientRect();
		this._viewport.zoomAt(width / 2, height / 2, 1.25);
	}

	zoomOut(): void {
		const { width, height } = this._svg.getBoundingClientRect();
		this._viewport.zoomAt(width / 2, height / 2, 0.8);
	}

	setZoom(scale: number): void {
		const { width, height } = this._svg.getBoundingClientRect();
		const vp = this._viewport.state;
		const cx = (width / 2 - vp.tx) / vp.scale;
		const cy = (height / 2 - vp.ty) / vp.scale;
		this._viewport.set({ tx: width / 2 - cx * scale, ty: height / 2 - cy * scale, scale });
	}

	selectAll(): void {
		this._setSelection(this._shapes.map((s) => s.id));
	}

	on<K extends keyof EditorEvents>(event: K, handler: EditorEvents[K]): () => void {
		let set = this._listeners.get(event);
		if (!set) {
			set = new Set();
			this._listeners.set(event, set);
		}
		set.add(handler as (...args: unknown[]) => void);
		return () => {
			const s = this._listeners.get(event);
			s?.delete(handler as (...args: unknown[]) => void);
		};
	}

	destroy(): void {
		this._ro.disconnect();
		this._viewport.destroy();
		this._keyboard.destroy();
		this._labelEditor.destroy();
		this._svg.removeEventListener("pointerdown", this._onPointerDown);
		this._svg.removeEventListener("pointermove", this._onPointerMove);
		this._svg.removeEventListener("pointerup", this._onPointerUp);
		this._svg.removeEventListener("dblclick", this._onDblClick);
		this._host.removeEventListener("keydown", this._onKeyDown);
		for (const plugin of this._plugins) plugin.uninstall?.();
		this._plugins.length = 0;
		this._listeners.clear();
		this._host.remove();
	}

	// ── Private helpers ────────────────────────────────────────────────

	private _renderDefs(defs: BpmnDefinitions): void {
		this._edgesG.innerHTML = "";
		this._shapesG.innerHTML = "";
		this._labelsG.innerHTML = "";
		const result = render(
			defs,
			this._edgesG,
			this._shapesG,
			this._labelsG,
			this._markerId,
			this._id,
		);
		this._shapes = result.shapes;
		this._edges = result.edges;
		this._defs = defs;

		// Add transparent hit-area polylines for edge clicking
		for (const edge of this._edges) {
			const waypoints = edge.edge.waypoints;
			if (waypoints.length < 2) continue;
			const points = waypoints.map((wp) => `${wp.x},${wp.y}`).join(" ");
			const hitArea = document.createElementNS(NS, "polyline") as SVGPolylineElement;
			hitArea.setAttribute("class", "bpmn-edge-hitarea");
			hitArea.setAttribute("data-bpmn-edge-hit", edge.id);
			hitArea.setAttribute("points", points);
			edge.element.appendChild(hitArea);
		}

		this._keyboard.setShapes(this._shapes);
		this._overlay.setSelection(this._selectedIds, this._shapes, this._getResizableIds());

		// Restore edge selection if the edge still exists after re-render
		if (this._selectedEdgeId) {
			const edge = this._edges.find((e) => e.id === this._selectedEdgeId);
			if (edge) {
				this._overlay.setEdgeEndpoints(edge.edge.waypoints, this._selectedEdgeId);
			} else {
				this._selectedEdgeId = null;
				this._overlay.setEdgeEndpoints(null, "");
			}
		}

		this._emit("diagram:load", defs);
	}

	private _executeCommand(fn: (d: BpmnDefinitions) => BpmnDefinitions): void {
		if (!this._defs) return;
		const newDefs = fn(this._defs);
		this._commandStack.push(newDefs);
		this._renderDefs(newDefs);
		this._emit("diagram:change", newDefs);
	}

	private _setSelection(ids: string[]): void {
		this._selectedIds = ids;
		// Clear edge selection whenever shape selection changes
		if (this._selectedEdgeId) {
			this._selectedEdgeId = null;
			this._overlay.setEdgeEndpoints(null, "");
		}
		this._overlay.setSelection(ids, this._shapes, this._getResizableIds());
		this._emit("editor:select", ids);
	}

	private _previewTranslate(dx: number, dy: number): void {
		const snapped = this._computeSnap(dx, dy);
		this._snapDelta = snapped;
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x + snapped.dx} ${y + snapped.dy})`);
		}
		this._overlay.setAlignmentGuides(this._computeAlignGuides(snapped.dx, snapped.dy));
		this._setEdgeDropHighlight(this._findEdgeDropTarget(snapped.dx, snapped.dy));
	}

	private _cancelTranslate(): void {
		this._snapDelta = null;
		this._overlay.setAlignmentGuides([]);
		this._setEdgeDropHighlight(null);
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
	}

	private _commitTranslate(dx: number, dy: number): void {
		const snap = this._snapDelta ?? { dx, dy };
		this._snapDelta = null;
		this._overlay.setAlignmentGuides([]);
		const edgeDropId = this._edgeDropTarget;
		this._setEdgeDropHighlight(null);
		const moves = this._selectedIds.map((id) => ({ id, dx: snap.dx, dy: snap.dy }));
		const shapeId = this._selectedIds.length === 1 ? this._selectedIds[0] : undefined;
		if (edgeDropId && shapeId) {
			this._executeCommand((d) => insertShapeOnEdge(moveShapes(d, moves), edgeDropId, shapeId));
		} else {
			this._executeCommand((d) => moveShapes(d, moves));
		}
	}

	private _previewSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void {
		// Reset all shapes to their original positions first
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		if (!axis) return;

		const dx = current.x - origin.x;
		const dy = current.y - origin.y;

		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			const cx = b.x + b.width / 2;
			const cy = b.y + b.height / 2;
			let moveDx = 0;
			let moveDy = 0;
			if (axis === "h") {
				if (dx > 0 && cx > origin.x) moveDx = dx;
				else if (dx < 0 && cx < origin.x) moveDx = dx;
			} else {
				if (dy > 0 && cy > origin.y) moveDy = dy;
				else if (dy < 0 && cy < origin.y) moveDy = dy;
			}
			if (moveDx !== 0 || moveDy !== 0) {
				shape.element.setAttribute("transform", `translate(${b.x + moveDx} ${b.y + moveDy})`);
			}
		}

		const splitValue = axis === "h" ? origin.x : origin.y;
		this._overlay.setSpacePreview(axis, splitValue);
	}

	private _commitSpace(origin: DiagPoint, current: DiagPoint, axis: "h" | "v" | null): void {
		// Reset visual preview
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		this._overlay.setSpacePreview(null);

		if (!axis || !this._defs) return;

		const dx = current.x - origin.x;
		const dy = current.y - origin.y;
		if (dx === 0 && dy === 0) return;

		const moves: Array<{ id: string; dx: number; dy: number }> = [];
		for (const shape of this._shapes) {
			const b = shape.shape.bounds;
			const cx = b.x + b.width / 2;
			const cy = b.y + b.height / 2;
			if (axis === "h") {
				if (dx > 0 && cx > origin.x) moves.push({ id: shape.id, dx, dy: 0 });
				else if (dx < 0 && cx < origin.x) moves.push({ id: shape.id, dx, dy: 0 });
			} else {
				if (dy > 0 && cy > origin.y) moves.push({ id: shape.id, dx: 0, dy });
				else if (dy < 0 && cy < origin.y) moves.push({ id: shape.id, dx: 0, dy });
			}
		}

		if (moves.length > 0) {
			this._executeCommand((d) => moveShapes(d, moves));
		}
	}

	private _cancelSpace(): void {
		for (const shape of this._shapes) {
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
		this._overlay.setSpacePreview(null);
	}

	private _doCreate(type: CreateShapeType, diagPoint: DiagPoint): void {
		this._overlay.setGhostCreate(null);
		this._overlay.setAlignmentGuides([]);
		const actualCenter = this._ghostSnapCenter ?? diagPoint;
		this._ghostSnapCenter = null;
		const edgeDropId = this._createEdgeDropTarget;
		this._setCreateEdgeDropHighlight(null);
		if (!this._defs) return;
		const bounds = defaultBounds(type, actualCenter.x, actualCenter.y);
		const result = createShape(this._defs, type, bounds);
		this._selectedIds = [result.id];
		const finalDefs = edgeDropId
			? insertShapeOnEdge(result.defs, edgeDropId, result.id)
			: result.defs;
		this._commandStack.push(finalDefs);
		this._renderDefs(finalDefs);
		this._emit("diagram:change", finalDefs);
		this._emit("editor:select", [result.id]);
	}

	private _doConnect(srcId: string, tgtId: string): void {
		const srcShape = this._shapes.find((s) => s.id === srcId);
		const tgtShape = this._shapes.find((s) => s.id === tgtId);
		if (!srcShape || !tgtShape) return;
		const srcType = srcShape.flowElement?.type;
		const tgtType = tgtShape.flowElement?.type;
		if (srcType && tgtType && !canConnect(srcType, tgtType)) return;
		const waypoints = computeWaypoints(srcShape.shape.bounds, tgtShape.shape.bounds);
		this._executeCommand((d) => createConnection(d, srcId, tgtId, waypoints).defs);
	}

	private _doCopy(): void {
		if (!this._defs || this._selectedIds.length === 0) return;
		this._clipboard = copyElements(this._defs, this._selectedIds);
	}

	private _doPaste(): void {
		if (!this._clipboard) return;
		const base = this._defs ?? createEmptyDefinitions();
		const result = pasteElements(base, this._clipboard, 20, 20);
		const newIds = [...result.newIds.values()];
		this._selectedIds = newIds;
		this._commandStack.push(result.defs);
		this._renderDefs(result.defs);
		this._emit("diagram:change", result.defs);
		this._emit("editor:select", newIds);
	}

	private _startLabelEdit(id: string): void {
		if (!id) return;
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return;
		const defs = this._defs;
		if (!defs) return;
		const process = defs.processes[0];
		const currentText =
			process?.flowElements.find((el) => el.id === id)?.name ??
			process?.sequenceFlows.find((sf) => sf.id === id)?.name ??
			"";
		this._labelEditor.start(
			id,
			currentText,
			shape.shape.bounds,
			this._viewport.state,
			this._svg.getBoundingClientRect(),
		);
	}

	private _connectSourceBounds(): { x: number; y: number; width: number; height: number } | null {
		const mode = this._stateMachine.mode;
		if (mode.mode !== "select") return null;
		const sub = mode.sub;
		const sourceId =
			sub.name === "connecting" ? sub.sourceId : sub.name === "pointing-port" ? sub.sourceId : null;
		if (!sourceId) return null;
		const shape = this._shapes.find((s) => s.id === sourceId);
		return shape ? shape.shape.bounds : null;
	}

	// ── New public helpers ─────────────────────────────────────────────

	/** Returns screen-space bounds of a shape (for positioning overlays). */
	getShapeBounds(id: string): { x: number; y: number; width: number; height: number } | null {
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return null;
		const b = shape.shape.bounds;
		const vp = this._viewport.state;
		const svgRect = this._svg.getBoundingClientRect();
		const { x, y } = diagramToScreen(b.x, b.y, vp, svgRect);
		return { x, y, width: b.width * vp.scale, height: b.height * vp.scale };
	}

	/** Returns the BPMN element type for a given id, or null if not found. */
	getElementType(id: string): string | null {
		return this._shapes.find((s) => s.id === id)?.flowElement?.type ?? null;
	}

	/**
	 * Creates a new element of the given type connected to the source shape,
	 * positioned to its right. Returns the new element's id.
	 */
	addConnectedElement(sourceId: string, type: CreateShapeType): string | null {
		if (!this._defs) return null;
		const srcShape = this._shapes.find((s) => s.id === sourceId);
		if (!srcShape) return null;
		const srcBounds = srcShape.shape.bounds;

		const GAP = 60;
		let w = 100;
		let h = 80;
		if (type === "startEvent" || type === "endEvent") {
			w = 36;
			h = 36;
		} else if (type === "exclusiveGateway" || type === "parallelGateway") {
			w = 50;
			h = 50;
		}

		const newBounds = {
			x: srcBounds.x + srcBounds.width + GAP,
			y: srcBounds.y + (srcBounds.height - h) / 2,
			width: w,
			height: h,
		};
		const r1 = createShape(this._defs, type, newBounds);
		const waypoints = computeWaypoints(srcBounds, newBounds);
		const r2 = createConnection(r1.defs, sourceId, r1.id, waypoints);

		this._selectedIds = [r1.id];
		this._commandStack.push(r2.defs);
		this._renderDefs(r2.defs);
		this._emit("diagram:change", r2.defs);
		this._emit("editor:select", [r1.id]);
		return r1.id;
	}

	/**
	 * Sets the external label position for an event or gateway shape.
	 */
	setLabelPosition(shapeId: string, position: LabelPosition): void {
		const shape = this._shapes.find((s) => s.id === shapeId);
		if (!shape) return;
		const labelBounds = labelBoundsForPosition(shape.shape.bounds, position);
		this._executeCommand((d) => updateLabelPosition(d, shapeId, labelBounds));
	}

	/** Copies then pastes the current selection with a small offset. */
	duplicate(): void {
		this._doCopy();
		this._doPaste();
	}

	/**
	 * Enters connection-drawing mode with the given shape as source.
	 * The user then moves the mouse and clicks a target shape to complete the connection.
	 */
	startConnectionFrom(sourceId: string): void {
		const shape = this._shapes.find((s) => s.id === sourceId);
		if (!shape) return;
		this._viewport.lock(true);
		this._stateMachine.setMode({
			mode: "select",
			sub: { name: "connecting", sourceId, ghostEnd: { x: 0, y: 0 } },
		});
	}

	// ── Private helpers ────────────────────────────────────────────────

	private _setEdgeSelected(edgeId: string | null): void {
		// Clear shape selection when edge is selected
		if (edgeId && this._selectedIds.length > 0) {
			this._selectedIds = [];
			this._overlay.setSelection([], this._shapes);
			this._emit("editor:select", []);
		}
		this._selectedEdgeId = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			this._overlay.setEdgeEndpoints(edge?.edge.waypoints ?? null, edgeId);
		} else {
			this._overlay.setEdgeEndpoints(null, "");
		}
	}

	/** Changes a flow element's type (e.g. exclusiveGateway → parallelGateway). */
	changeElementType(id: string, newType: CreateShapeType): void {
		this._executeCommand((d) => changeElementTypeFn(d, id, newType));
	}

	private _findEdgeDropTarget(dx: number, dy: number): string | null {
		if (this._selectedIds.length !== 1) return null;
		const id = this._selectedIds[0];
		if (!id || !this._defs) return null;
		const shape = this._shapes.find((s) => s.id === id);
		if (!shape) return null;

		const b = shape.shape.bounds;
		const cx = b.x + dx + b.width / 2;
		const cy = b.y + dy + b.height / 2;

		const process = this._defs.processes[0];
		if (!process) return null;

		const TOLERANCE = 20;

		for (const edge of this._edges) {
			const flow = process.sequenceFlows.find((sf) => sf.id === edge.id);
			if (!flow) continue;
			// Skip edges that are already connected to the shape being moved
			if (flow.sourceRef === id || flow.targetRef === id) continue;

			const wps = edge.edge.waypoints;
			for (let i = 0; i < wps.length - 1; i++) {
				const a = wps[i];
				const b2 = wps[i + 1];
				if (!a || !b2) continue;

				const minX = Math.min(a.x, b2.x) - TOLERANCE;
				const maxX = Math.max(a.x, b2.x) + TOLERANCE;
				const minY = Math.min(a.y, b2.y) - TOLERANCE;
				const maxY = Math.max(a.y, b2.y) + TOLERANCE;

				if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
					return edge.id;
				}
			}
		}
		return null;
	}

	private _setEdgeDropHighlight(edgeId: string | null): void {
		if (this._edgeDropTarget) {
			const prev = this._edges.find((e) => e.id === this._edgeDropTarget);
			prev?.element.classList.remove("bpmn-edge-split-highlight");
		}
		this._edgeDropTarget = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			edge?.element.classList.add("bpmn-edge-split-highlight");
		}
	}

	private _previewEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void {
		if (!this._defs) return;
		const edge = this._edges.find((e) => e.id === edgeId);
		if (!edge) return;
		const flow = this._defs.processes[0]?.sequenceFlows.find((sf) => sf.id === edgeId);
		if (!flow) return;
		const plane = this._defs.diagrams[0]?.plane;
		if (!plane) return;
		const srcDi = plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
		const tgtDi = plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
		if (!srcDi || !tgtDi) return;
		const waypoints = edge.edge.waypoints;
		let srcPort: PortDir;
		let tgtPort: PortDir;
		if (isStart) {
			srcPort = closestPort(diagPoint, srcDi.bounds);
			const lastWp = waypoints[waypoints.length - 1];
			tgtPort = lastWp ? portFromWaypoint(lastWp, tgtDi.bounds) : "left";
		} else {
			const firstWp = waypoints[0];
			srcPort = firstWp ? portFromWaypoint(firstWp, srcDi.bounds) : "right";
			tgtPort = closestPort(diagPoint, tgtDi.bounds);
		}
		const newWaypoints = computeWaypointsWithPorts(srcDi.bounds, srcPort, tgtDi.bounds, tgtPort);
		this._overlay.setEndpointDragGhost(newWaypoints);
	}

	private _commitEndpointMove(edgeId: string, isStart: boolean, diagPoint: DiagPoint): void {
		if (!this._defs) return;
		this._overlay.setEndpointDragGhost(null);
		const edge = this._edges.find((e) => e.id === edgeId);
		if (!edge) return;
		const flow = this._defs.processes[0]?.sequenceFlows.find((sf) => sf.id === edgeId);
		if (!flow) return;
		const plane = this._defs.diagrams[0]?.plane;
		if (!plane) return;
		const srcDi = plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
		const tgtDi = plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
		if (!srcDi || !tgtDi) return;
		const newPort = isStart
			? closestPort(diagPoint, srcDi.bounds)
			: closestPort(diagPoint, tgtDi.bounds);
		this._executeCommand((d) => updateEdgeEndpoint(d, edgeId, isStart, newPort));
	}

	private _isResizable(id: string): boolean {
		const el = this._shapes.find((s) => s.id === id)?.flowElement;
		return el !== undefined && RESIZABLE_TYPES.has(el.type);
	}

	private _getResizableIds(): Set<string> {
		const ids = new Set<string>();
		for (const shape of this._shapes) {
			if (shape.flowElement && RESIZABLE_TYPES.has(shape.flowElement.type)) {
				ids.add(shape.id);
			}
		}
		return ids;
	}

	// ── Snap / alignment guides ───────────────────────────────────────

	private _computeSnap(dx: number, dy: number): { dx: number; dy: number } {
		const selectedSet = new Set(this._selectedIds);
		const movingShapes = this._shapes.filter((s) => selectedSet.has(s.id));
		const staticShapes = this._shapes.filter((s) => !selectedSet.has(s.id));
		if (movingShapes.length === 0) return { dx, dy };

		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;

		const movingXVals: number[] = [];
		const movingYVals: number[] = [];
		for (const s of movingShapes) {
			const b = s.shape.bounds;
			movingXVals.push(b.x + dx, b.x + dx + b.width / 2, b.x + dx + b.width);
			movingYVals.push(b.y + dy, b.y + dy + b.height / 2, b.y + dy + b.height);
		}

		const staticXVals: number[] = [];
		const staticYVals: number[] = [];
		for (const s of staticShapes) {
			const b = s.shape.bounds;
			staticXVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			staticYVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}
		// Include original positions of moving shapes as virtual snap targets
		for (const s of movingShapes) {
			const b = s.shape.bounds;
			staticXVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			staticYVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}

		let bestDx = dx;
		let bestDy = dy;
		let minDistX = threshold;
		let minDistY = threshold;

		for (const mx of movingXVals) {
			for (const sx of staticXVals) {
				const dist = Math.abs(mx - sx);
				if (dist < minDistX) {
					minDistX = dist;
					bestDx = dx + (sx - mx);
				}
			}
		}

		for (const my of movingYVals) {
			for (const sy of staticYVals) {
				const dist = Math.abs(my - sy);
				if (dist < minDistY) {
					minDistY = dist;
					bestDy = dy + (sy - my);
				}
			}
		}

		return { dx: bestDx, dy: bestDy };
	}

	private _computeAlignGuides(
		dx: number,
		dy: number,
	): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const selectedSet = new Set(this._selectedIds);
		const movingShapes = this._shapes.filter((s) => selectedSet.has(s.id));
		const staticShapes = this._shapes.filter((s) => !selectedSet.has(s.id));
		if (movingShapes.length === 0) return [];

		const guides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		const EXT = 2000;
		// Include original positions of moving shapes as virtual reference points
		const allStaticRef = [...staticShapes, ...movingShapes];

		for (const ms of movingShapes) {
			const mb = ms.shape.bounds;
			const mxVals = [mb.x + dx, mb.x + dx + mb.width / 2, mb.x + dx + mb.width];
			const myVals = [mb.y + dy, mb.y + dy + mb.height / 2, mb.y + dy + mb.height];

			for (const ss of allStaticRef) {
				const sb = ss.shape.bounds;
				const sxVals = [sb.x, sb.x + sb.width / 2, sb.x + sb.width];
				const syVals = [sb.y, sb.y + sb.height / 2, sb.y + sb.height];

				for (const mx of mxVals) {
					for (const sx of sxVals) {
						if (Math.abs(mx - sx) < 1) {
							guides.push({ x1: mx, y1: -EXT, x2: mx, y2: EXT });
						}
					}
				}
				for (const my of myVals) {
					for (const sy of syVals) {
						if (Math.abs(my - sy) < 1) {
							guides.push({ x1: -EXT, y1: my, x2: EXT, y2: my });
						}
					}
				}
			}
		}

		return guides;
	}

	// ── Create-mode helpers ────────────────────────────────────────────

	private _computeCreateSnap(bounds: BpmnBounds): BpmnBounds {
		if (this._shapes.length === 0) return bounds;
		const scale = this._viewport.state.scale;
		const threshold = 8 / scale;

		const bxVals = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
		const byVals = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

		const sxVals: number[] = [];
		const syVals: number[] = [];
		for (const s of this._shapes) {
			const b = s.shape.bounds;
			sxVals.push(b.x, b.x + b.width / 2, b.x + b.width);
			syVals.push(b.y, b.y + b.height / 2, b.y + b.height);
		}

		let bestDx = 0;
		let bestDy = 0;
		let minDistX = threshold;
		let minDistY = threshold;

		for (const bx of bxVals) {
			for (const sx of sxVals) {
				const dist = Math.abs(bx - sx);
				if (dist < minDistX) {
					minDistX = dist;
					bestDx = sx - bx;
				}
			}
		}
		for (const by of byVals) {
			for (const sy of syVals) {
				const dist = Math.abs(by - sy);
				if (dist < minDistY) {
					minDistY = dist;
					bestDy = sy - by;
				}
			}
		}

		return { ...bounds, x: bounds.x + bestDx, y: bounds.y + bestDy };
	}

	private _computeCreateGuides(
		bounds: BpmnBounds,
	): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const guides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		const EXT = 2000;
		const bxVals = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
		const byVals = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

		for (const s of this._shapes) {
			const sb = s.shape.bounds;
			const sxVals = [sb.x, sb.x + sb.width / 2, sb.x + sb.width];
			const syVals = [sb.y, sb.y + sb.height / 2, sb.y + sb.height];
			for (const bx of bxVals) {
				for (const sx of sxVals) {
					if (Math.abs(bx - sx) < 1) guides.push({ x1: bx, y1: -EXT, x2: bx, y2: EXT });
				}
			}
			for (const by of byVals) {
				for (const sy of syVals) {
					if (Math.abs(by - sy) < 1) guides.push({ x1: -EXT, y1: by, x2: EXT, y2: by });
				}
			}
		}

		return guides;
	}

	private _findCreateEdgeDrop(bounds: BpmnBounds): string | null {
		if (!this._defs) return null;
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		const process = this._defs.processes[0];
		if (!process) return null;
		const TOLERANCE = 20;
		for (const edge of this._edges) {
			const flow = process.sequenceFlows.find((sf) => sf.id === edge.id);
			if (!flow) continue;
			const wps = edge.edge.waypoints;
			for (let i = 0; i < wps.length - 1; i++) {
				const a = wps[i];
				const b = wps[i + 1];
				if (!a || !b) continue;
				const minX = Math.min(a.x, b.x) - TOLERANCE;
				const maxX = Math.max(a.x, b.x) + TOLERANCE;
				const minY = Math.min(a.y, b.y) - TOLERANCE;
				const maxY = Math.max(a.y, b.y) + TOLERANCE;
				if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) return edge.id;
			}
		}
		return null;
	}

	private _setCreateEdgeDropHighlight(edgeId: string | null): void {
		if (this._createEdgeDropTarget === edgeId) return;
		if (this._createEdgeDropTarget) {
			const prev = this._edges.find((e) => e.id === this._createEdgeDropTarget);
			prev?.element.classList.remove("bpmn-edge-split-highlight");
		}
		this._createEdgeDropTarget = edgeId;
		if (edgeId) {
			const edge = this._edges.find((e) => e.id === edgeId);
			edge?.element.classList.add("bpmn-edge-split-highlight");
		}
	}

	// ── Pointer event handlers ─────────────────────────────────────────

	private readonly _onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerDown(e, diag, hit);
	};

	private readonly _onPointerMove = (e: PointerEvent): void => {
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerMove(e, diag, hit);
		const mode = this._stateMachine.mode;
		if (mode.mode === "create") {
			const rawBounds = defaultBounds(mode.elementType, diag.x, diag.y);
			const snapped = this._computeCreateSnap(rawBounds);
			const snappedCenter: DiagPoint = {
				x: snapped.x + snapped.width / 2,
				y: snapped.y + snapped.height / 2,
			};
			this._ghostSnapCenter = snappedCenter;
			this._overlay.setGhostCreate(mode.elementType, snappedCenter);
			this._overlay.setAlignmentGuides(this._computeCreateGuides(snapped));
			this._setCreateEdgeDropHighlight(this._findCreateEdgeDrop(snapped));
		}
	};

	private readonly _onPointerUp = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onPointerUp(e, diag, hit);
	};

	private readonly _onDblClick = (e: MouseEvent): void => {
		const rect = this._svg.getBoundingClientRect();
		const diag = screenToDiagram(e.clientX, e.clientY, this._viewport.state, rect);
		const hit = this._hitTest(e.clientX, e.clientY);
		this._stateMachine.onDblClick(e, diag, hit);
	};

	private readonly _onKeyDown = (e: KeyboardEvent): void => {
		this._stateMachine.onKeyDown(e);

		if (e.ctrlKey || e.metaKey) {
			switch (e.key) {
				case "z":
					if (e.shiftKey) {
						e.preventDefault();
						this.redo();
					} else {
						e.preventDefault();
						this.undo();
					}
					break;
				case "y":
					e.preventDefault();
					this.redo();
					break;
				case "a":
					e.preventDefault();
					this._setSelection(this._shapes.map((s) => s.id));
					break;
				case "c":
					e.preventDefault();
					this._doCopy();
					break;
				case "v":
					e.preventDefault();
					this._doPaste();
					break;
			}
		}
	};

	// ── Hit testing ───────────────────────────────────────────────────

	private _hitTest(clientX: number, clientY: number): HitResult {
		const el = document.elementFromPoint(clientX, clientY);
		if (!el) return { type: "canvas" };

		const handleEl = el.closest("[data-bpmn-handle]");
		if (handleEl) {
			const shapeId = handleEl.getAttribute("data-bpmn-id");
			const handle = handleEl.getAttribute("data-bpmn-handle") as HandleDir | null;
			if (shapeId && handle) return { type: "handle", shapeId, handle };
		}

		const portEl = el.closest("[data-bpmn-port]");
		if (portEl) {
			const shapeId = portEl.getAttribute("data-bpmn-id");
			const port = portEl.getAttribute("data-bpmn-port") as PortDir | null;
			if (shapeId && port) return { type: "port", shapeId, port };
		}

		const endpointEl = el.closest("[data-bpmn-endpoint]");
		if (endpointEl) {
			const edgeId = endpointEl.getAttribute("data-bpmn-id");
			const ep = endpointEl.getAttribute("data-bpmn-endpoint");
			if (edgeId && ep) return { type: "edge-endpoint", edgeId, isStart: ep === "start" };
		}

		const edgeHitEl = el.closest("[data-bpmn-edge-hit]");
		if (edgeHitEl) {
			const id = edgeHitEl.getAttribute("data-bpmn-edge-hit");
			if (id) return { type: "edge", id };
		}

		const shapeEl = el.closest("[data-bpmn-id]");
		if (shapeEl && this._shapesG.contains(shapeEl)) {
			const id = shapeEl.getAttribute("data-bpmn-id");
			if (id) return { type: "shape", id };
		}

		return { type: "canvas" };
	}

	// ── Theme + controls ──────────────────────────────────────────────

	private _applyTheme(theme: Theme): void {
		const resolved =
			theme === "auto"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light"
				: theme;
		if (resolved === "dark") {
			this._host.setAttribute("data-theme", "dark");
		} else {
			this._host.removeAttribute("data-theme");
		}
	}

	private _installPlugin(plugin: CanvasPlugin): void {
		this._plugins.push(plugin);
		const self = this;
		const api: CanvasApi = {
			container: this._host,
			svg: this._svg,
			viewportEl: this._viewportG,
			getViewport: () => this._viewport.state,
			setViewport: (s) => this._viewport.set(s),
			getShapes: () => [...this._shapes],
			getEdges: () => [...this._edges],
			getTheme: () => this._theme,
			setTheme: (theme) => this.setTheme(theme),
			on<K extends keyof CanvasEvents>(event: K, handler: CanvasEvents[K]) {
				return self.on(event as keyof EditorEvents, handler as EditorEvents[keyof EditorEvents]);
			},
			emit<K extends keyof CanvasEvents>(event: K, ...args: Parameters<CanvasEvents[K]>) {
				self._emit(
					event as keyof EditorEvents,
					...(args as Parameters<EditorEvents[keyof EditorEvents]>),
				);
			},
		};
		plugin.install(api);
	}

	private _emit<K extends keyof EditorEvents>(
		event: K,
		...args: Parameters<EditorEvents[K]>
	): void {
		const handlers = this._listeners.get(event);
		if (!handlers) return;
		for (const h of handlers) {
			(h as (...a: typeof args) => void)(...args);
		}
	}
}
