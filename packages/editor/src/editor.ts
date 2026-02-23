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
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { CommandStack } from "./command-stack.js";
import { injectEditorStyles } from "./css.js";
import { computeWaypoints, screenToDiagram } from "./geometry.js";
import { LabelEditor } from "./label-editor.js";
import {
	copyElements,
	createConnection,
	createEmptyDefinitions,
	createShape,
	deleteElements,
	moveShapes,
	pasteElements,
	resizeShape,
	updateLabel,
} from "./modeling.js";
import type { Clipboard } from "./modeling.js";
import { OverlayRenderer } from "./overlay.js";
import { canConnect } from "./rules.js";
import { EditorStateMachine } from "./state-machine.js";
import type { Callbacks } from "./state-machine.js";
import type {
	CreateShapeType,
	DiagPoint,
	EditorEvents,
	EditorOptions,
	HandleDir,
	HitResult,
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
				if (src) this._overlay.setGhostConnection(src, ghostEnd);
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

		// ── Zoom controls ─────────────────────────────────────────────
		this._addZoomControls();

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
		if (tool === "select") {
			this._stateMachine.setMode({ mode: "select", sub: { name: "idle", hoveredId: null } });
		} else if (tool === "pan") {
			this._stateMachine.setMode({ mode: "pan" });
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
		this._keyboard.setShapes(this._shapes);
		this._overlay.setSelection(this._selectedIds, this._shapes);
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
		this._overlay.setSelection(ids, this._shapes);
		this._emit("editor:select", ids);
	}

	private _previewTranslate(dx: number, dy: number): void {
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x + dx} ${y + dy})`);
		}
	}

	private _cancelTranslate(): void {
		for (const id of this._selectedIds) {
			const shape = this._shapes.find((s) => s.id === id);
			if (!shape) continue;
			const { x, y } = shape.shape.bounds;
			shape.element.setAttribute("transform", `translate(${x} ${y})`);
		}
	}

	private _commitTranslate(dx: number, dy: number): void {
		const moves = this._selectedIds.map((id) => ({ id, dx, dy }));
		this._executeCommand((d) => moveShapes(d, moves));
	}

	private _doCreate(type: CreateShapeType, diagPoint: DiagPoint): void {
		if (!this._defs) return;
		const bounds = defaultBounds(type, diagPoint.x, diagPoint.y);
		const result = createShape(this._defs, type, bounds);
		this._selectedIds = [result.id];
		this._commandStack.push(result.defs);
		this._renderDefs(result.defs);
		this._emit("diagram:change", result.defs);
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

	private _addZoomControls(): void {
		const controls = document.createElement("div");
		controls.className = "bpmn-controls";
		controls.setAttribute("aria-label", "Zoom controls");
		const makeBtn = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
			const btn = document.createElement("button");
			btn.className = "bpmn-control-btn";
			btn.type = "button";
			btn.textContent = label;
			btn.setAttribute("aria-label", title);
			btn.title = title;
			btn.addEventListener("click", onClick);
			return btn;
		};
		controls.appendChild(makeBtn("+", "Zoom in", () => this.zoomIn()));
		controls.appendChild(makeBtn("−", "Zoom out", () => this.zoomOut()));
		controls.appendChild(makeBtn("⊡", "Fit diagram", () => this.fitView()));
		this._host.appendChild(controls);
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
