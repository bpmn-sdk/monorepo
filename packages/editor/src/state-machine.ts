import type { RenderedShape, ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnBounds } from "@bpmn-sdk/core";
import { applyResize } from "./geometry.js";
import type { CreateShapeType, DiagPoint, HandleDir, HitResult, PortDir, Tool } from "./types.js";

// ── State types ──────────────────────────────────────────────────────────────

type SelectSub =
	| { name: "idle"; hoveredId: string | null }
	| { name: "pointing-canvas"; origin: DiagPoint; screenX: number; screenY: number }
	| { name: "rubber-band"; origin: DiagPoint; current: DiagPoint }
	| { name: "pointing-shape"; origin: DiagPoint; id: string; screenX: number; screenY: number }
	| { name: "translating"; origin: DiagPoint; last: DiagPoint }
	| {
			name: "pointing-handle";
			origin: DiagPoint;
			id: string;
			handle: HandleDir;
			screenX: number;
			screenY: number;
	  }
	| { name: "resizing"; id: string; handle: HandleDir; original: BpmnBounds; current: DiagPoint }
	| {
			name: "pointing-port";
			origin: DiagPoint;
			sourceId: string;
			port: PortDir;
			screenX: number;
			screenY: number;
	  }
	| { name: "connecting"; sourceId: string; ghostEnd: DiagPoint }
	| { name: "editing-label"; id: string };

export type EditorMode =
	| { mode: "select"; sub: SelectSub }
	| { mode: "create"; elementType: CreateShapeType }
	| { mode: "pan" };

// ── Callbacks ─────────────────────────────────────────────────────────────────

export interface Callbacks {
	getShapes(): RenderedShape[];
	getSelectedIds(): string[];
	getViewport(): ViewportState;
	viewportDidPan(): boolean;
	lockViewport(lock: boolean): void;
	setSelection(ids: string[]): void;
	previewTranslate(dx: number, dy: number): void;
	commitTranslate(dx: number, dy: number): void;
	cancelTranslate(): void;
	previewResize(bounds: BpmnBounds): void;
	commitResize(id: string, bounds: BpmnBounds): void;
	previewConnect(ghostEnd: DiagPoint): void;
	cancelConnect(): void;
	commitConnect(sourceId: string, targetId: string): void;
	previewRubberBand(origin: DiagPoint, current: DiagPoint): void;
	cancelRubberBand(): void;
	commitCreate(type: CreateShapeType, diagPoint: DiagPoint): void;
	startLabelEdit(id: string): void;
	setHovered(id: string | null): void;
	executeDelete(ids: string[]): void;
	executeCopy(): void;
	executePaste(): void;
	setTool(tool: Tool): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 4; // screen pixels

function screenDist(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by);
}

/**
 * Discriminated-union state machine for the BPMN editor.
 * Receives pointer + keyboard events from the editor and notifies the editor
 * via injected `Callbacks`.
 */
export class EditorStateMachine {
	private _mode: EditorMode = { mode: "select", sub: { name: "idle", hoveredId: null } };

	constructor(private readonly _cb: Callbacks) {}

	get mode(): EditorMode {
		return this._mode;
	}

	setMode(mode: EditorMode): void {
		this._mode = mode;
	}

	// ── Pointer down ─────────────────────────────────────────────────

	onPointerDown(e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode;

		// Create mode: place shape and revert to select
		if (mode.mode === "create") {
			this._cb.commitCreate(mode.elementType, diag);
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
			this._cb.setTool("select");
			return;
		}

		// Pan mode: viewport handles this
		if (mode.mode === "pan") return;

		// In label-editing mode: clicking elsewhere commits label (via blur) — do nothing here
		if (mode.sub.name === "editing-label") return;

		switch (hit.type) {
			case "handle": {
				const shapes = this._cb.getShapes();
				const shape = shapes.find((s) => s.id === hit.shapeId);
				if (!shape) return;
				this._cb.lockViewport(true);
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-handle",
						origin: diag,
						id: hit.shapeId,
						handle: hit.handle,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				};
				break;
			}

			case "port": {
				this._cb.lockViewport(true);
				this._mode = {
					mode: "select",
					sub: {
						name: "pointing-port",
						origin: diag,
						sourceId: hit.shapeId,
						port: hit.port,
						screenX: e.clientX,
						screenY: e.clientY,
					},
				};
				break;
			}

			case "shape": {
				const selectedIds = this._cb.getSelectedIds();
				if (e.shiftKey) {
					const newIds = selectedIds.includes(hit.id)
						? selectedIds.filter((id) => id !== hit.id)
						: [...selectedIds, hit.id];
					this._cb.setSelection(newIds);
					this._mode = { mode: "select", sub: { name: "idle", hoveredId: hit.id } };
				} else {
					if (!selectedIds.includes(hit.id)) {
						this._cb.setSelection([hit.id]);
					}
					this._mode = {
						mode: "select",
						sub: {
							name: "pointing-shape",
							origin: diag,
							id: hit.id,
							screenX: e.clientX,
							screenY: e.clientY,
						},
					};
				}
				break;
			}

			case "canvas": {
				if (e.shiftKey) {
					this._cb.lockViewport(true);
					this._mode = {
						mode: "select",
						sub: { name: "rubber-band", origin: diag, current: diag },
					};
				} else {
					this._mode = {
						mode: "select",
						sub: {
							name: "pointing-canvas",
							origin: diag,
							screenX: e.clientX,
							screenY: e.clientY,
						},
					};
				}
				break;
			}
		}
	}

	// ── Pointer move ─────────────────────────────────────────────────

	onPointerMove(e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode;

		if (mode.mode !== "select") {
			if (mode.mode === "create") {
				// Ghost create: update overlay (editor reads state.mode to update ghost)
			}
			return;
		}

		const sub = mode.sub;

		switch (sub.name) {
			case "idle": {
				const hoveredId = hit.type === "shape" ? hit.id : null;
				if (hoveredId !== sub.hoveredId) {
					this._cb.setHovered(hoveredId);
					this._mode = { mode: "select", sub: { name: "idle", hoveredId } };
				}
				break;
			}

			case "pointing-shape": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY);
				if (dist > DRAG_THRESHOLD) {
					this._cb.lockViewport(true);
					this._mode = {
						mode: "select",
						sub: { name: "translating", origin: sub.origin, last: diag },
					};
					const dx = diag.x - sub.origin.x;
					const dy = diag.y - sub.origin.y;
					this._cb.previewTranslate(dx, dy);
				}
				break;
			}

			case "translating": {
				const dx = diag.x - sub.origin.x;
				const dy = diag.y - sub.origin.y;
				this._mode = { mode: "select", sub: { ...sub, last: diag } };
				this._cb.previewTranslate(dx, dy);
				break;
			}

			case "pointing-handle": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY);
				if (dist > DRAG_THRESHOLD) {
					const shapes = this._cb.getShapes();
					const shape = shapes.find((s) => s.id === sub.id);
					if (!shape) break;
					const newBounds = applyResize(shape.shape.bounds, sub.handle, diag.x, diag.y);
					this._mode = {
						mode: "select",
						sub: {
							name: "resizing",
							id: sub.id,
							handle: sub.handle,
							original: shape.shape.bounds,
							current: diag,
						},
					};
					this._cb.previewResize(newBounds);
				}
				break;
			}

			case "resizing": {
				const newBounds = applyResize(sub.original, sub.handle, diag.x, diag.y);
				this._mode = { mode: "select", sub: { ...sub, current: diag } };
				this._cb.previewResize(newBounds);
				break;
			}

			case "pointing-port": {
				const dist = screenDist(e.clientX, e.clientY, sub.screenX, sub.screenY);
				if (dist > DRAG_THRESHOLD) {
					this._mode = {
						mode: "select",
						sub: { name: "connecting", sourceId: sub.sourceId, ghostEnd: diag },
					};
					this._cb.previewConnect(diag);
				}
				break;
			}

			case "connecting": {
				this._mode = { mode: "select", sub: { ...sub, ghostEnd: diag } };
				this._cb.previewConnect(diag);
				break;
			}

			case "rubber-band": {
				this._mode = { mode: "select", sub: { ...sub, current: diag } };
				this._cb.previewRubberBand(sub.origin, diag);
				break;
			}

			default:
				break;
		}
	}

	// ── Pointer up ────────────────────────────────────────────────────

	onPointerUp(_e: PointerEvent, diag: DiagPoint, hit: HitResult): void {
		const mode = this._mode;
		if (mode.mode !== "select") return;

		const sub = mode.sub;

		switch (sub.name) {
			case "pointing-shape": {
				this._cb.setSelection([sub.id]);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: sub.id } };
				break;
			}

			case "translating": {
				const dx = diag.x - sub.origin.x;
				const dy = diag.y - sub.origin.y;
				this._cb.lockViewport(false);
				this._cb.commitTranslate(dx, dy);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "pointing-handle": {
				this._cb.lockViewport(false);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "resizing": {
				const newBounds = applyResize(sub.original, sub.handle, diag.x, diag.y);
				this._cb.lockViewport(false);
				this._cb.commitResize(sub.id, newBounds);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "pointing-port": {
				this._cb.lockViewport(false);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "connecting": {
				this._cb.lockViewport(false);
				if (hit.type === "shape" && hit.id !== sub.sourceId) {
					this._cb.commitConnect(sub.sourceId, hit.id);
				} else {
					this._cb.cancelConnect();
				}
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "rubber-band": {
				this._cb.lockViewport(false);
				this._cb.cancelRubberBand();
				const minX = Math.min(sub.origin.x, sub.current.x);
				const maxX = Math.max(sub.origin.x, sub.current.x);
				const minY = Math.min(sub.origin.y, sub.current.y);
				const maxY = Math.max(sub.origin.y, sub.current.y);
				const shapes = this._cb.getShapes();
				const ids = shapes
					.filter((s) => {
						const b = s.shape.bounds;
						return b.x + b.width > minX && b.x < maxX && b.y + b.height > minY && b.y < maxY;
					})
					.map((s) => s.id);
				this._cb.setSelection(ids);
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			case "pointing-canvas": {
				if (!this._cb.viewportDidPan()) {
					this._cb.setSelection([]);
				}
				this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
				break;
			}

			default:
				break;
		}
	}

	// ── Double-click ──────────────────────────────────────────────────

	onDblClick(_e: MouseEvent, _diag: DiagPoint, hit: HitResult): void {
		if (hit.type === "shape") {
			this._mode = { mode: "select", sub: { name: "editing-label", id: hit.id } };
			this._cb.startLabelEdit(hit.id);
		}
	}

	// ── Key down ──────────────────────────────────────────────────────

	onKeyDown(e: KeyboardEvent): void {
		const mode = this._mode;

		if (mode.mode === "create" && e.key === "Escape") {
			e.preventDefault();
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
			this._cb.setTool("select");
			return;
		}

		if (mode.mode !== "select") return;

		const sub = mode.sub;

		if (e.key === "Escape") {
			e.preventDefault();
			// Cancel in-progress operations
			if (sub.name === "translating") {
				this._cb.cancelTranslate();
				this._cb.lockViewport(false);
			} else if (
				sub.name === "rubber-band" ||
				sub.name === "pointing-handle" ||
				sub.name === "resizing" ||
				sub.name === "connecting" ||
				sub.name === "pointing-port"
			) {
				this._cb.lockViewport(false);
			}
			this._cb.setSelection([]);
			this._mode = { mode: "select", sub: { name: "idle", hoveredId: null } };
			return;
		}

		if (e.key === "Delete" || e.key === "Backspace") {
			// Don't delete while label-editing
			if (sub.name === "editing-label") return;
			e.preventDefault();
			const ids = this._cb.getSelectedIds();
			if (ids.length > 0) {
				this._cb.executeDelete(ids);
			}
			return;
		}
	}
}
