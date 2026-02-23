import type { RenderedShape } from "@bpmn-sdk/canvas";
import type { BpmnBounds } from "@bpmn-sdk/core";
import { handlePositions, portPositions } from "./geometry.js";
import type { CreateShapeType, DiagPoint, HandleDir, PortDir } from "./types.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(NS, tag);
}

function attr(el: Element, attrs: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
}

const HANDLE_SIZE = 7;
const PORT_RADIUS = 6;

const ALL_HANDLES: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const ALL_PORTS: PortDir[] = ["top", "right", "bottom", "left"];

/**
 * Renders editor overlays (selection handles, connection ports, rubber-band,
 * resize preview, ghost shapes) inside a dedicated SVG group that lives in
 * the viewport's coordinate space.
 */
export class OverlayRenderer {
	private readonly _g: SVGGElement;
	private readonly _markerId: string;

	// Sub-groups for each overlay layer
	private readonly _selectionG: SVGGElement;
	private readonly _portsG: SVGGElement;
	private readonly _rubberG: SVGGElement;
	private readonly _resizePreviewG: SVGGElement;
	private readonly _ghostConnG: SVGGElement;
	private readonly _ghostCreateG: SVGGElement;

	constructor(overlayGroup: SVGGElement, markerId: string) {
		this._g = overlayGroup;
		this._markerId = markerId;

		this._selectionG = svgEl("g");
		this._portsG = svgEl("g");
		this._rubberG = svgEl("g");
		this._resizePreviewG = svgEl("g");
		this._ghostConnG = svgEl("g");
		this._ghostCreateG = svgEl("g");

		this._g.appendChild(this._ghostCreateG);
		this._g.appendChild(this._ghostConnG);
		this._g.appendChild(this._rubberG);
		this._g.appendChild(this._resizePreviewG);
		this._g.appendChild(this._selectionG);
		this._g.appendChild(this._portsG);
	}

	// ── Selection + handles ───────────────────────────────────────────

	setSelection(ids: string[], shapes: RenderedShape[], resizableIds?: ReadonlySet<string>): void {
		this._selectionG.innerHTML = "";

		const selected = shapes.filter((s) => ids.includes(s.id));
		if (selected.length === 0) return;

		const isSingle = selected.length === 1;

		for (const shape of selected) {
			const { x, y, width, height } = shape.shape.bounds;

			// Selection outline
			const outline = svgEl("rect");
			attr(outline, {
				class: "bpmn-sel-indicator",
				x: x - 2,
				y: y - 2,
				width: width + 4,
				height: height + 4,
				rx: 2,
				"data-bpmn-id": shape.id,
			});
			this._selectionG.appendChild(outline);

			// Resize handles only for single selection of resizable elements
			if (isSingle && resizableIds?.has(shape.id)) {
				const positions = handlePositions(shape.shape.bounds);
				for (const dir of ALL_HANDLES) {
					const pos = positions[dir];
					const handle = svgEl("rect");
					attr(handle, {
						class: "bpmn-resize-handle",
						"data-bpmn-handle": dir,
						"data-bpmn-id": shape.id,
						x: pos.x - HANDLE_SIZE / 2,
						y: pos.y - HANDLE_SIZE / 2,
						width: HANDLE_SIZE,
						height: HANDLE_SIZE,
					});
					this._selectionG.appendChild(handle);
				}
			}
		}
	}

	// ── Hover ports ───────────────────────────────────────────────────

	setHovered(id: string | null, shapes: RenderedShape[]): void {
		this._portsG.innerHTML = "";
		if (!id) return;

		const shape = shapes.find((s) => s.id === id);
		if (!shape) return;

		const ports = portPositions(shape.shape.bounds);
		for (const port of ports) {
			const circle = svgEl("circle");
			attr(circle, {
				class: "bpmn-conn-port",
				"data-bpmn-port": port.dir,
				"data-bpmn-id": id,
				cx: port.x,
				cy: port.y,
				r: PORT_RADIUS,
			});
			this._portsG.appendChild(circle);
		}
	}

	// ── Rubber-band ────────────────────────────────────────────────────

	setRubberBand(origin: DiagPoint | null, current?: DiagPoint): void {
		this._rubberG.innerHTML = "";
		if (!origin || !current) return;

		const x = Math.min(origin.x, current.x);
		const y = Math.min(origin.y, current.y);
		const width = Math.abs(current.x - origin.x);
		const height = Math.abs(current.y - origin.y);

		const rect = svgEl("rect");
		attr(rect, { class: "bpmn-rubber-band", x, y, width, height });
		this._rubberG.appendChild(rect);
	}

	// ── Resize preview ─────────────────────────────────────────────────

	setResizePreview(bounds: BpmnBounds | null): void {
		this._resizePreviewG.innerHTML = "";
		if (!bounds) return;

		const rect = svgEl("rect");
		attr(rect, {
			class: "bpmn-resize-preview",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
		});
		this._resizePreviewG.appendChild(rect);
	}

	// ── Ghost connection ───────────────────────────────────────────────

	setGhostConnection(src: BpmnBounds | null, end?: DiagPoint): void {
		this._ghostConnG.innerHTML = "";
		if (!src || !end) return;

		const srcCx = src.x + src.width / 2;
		const srcCy = src.y + src.height / 2;

		const line = svgEl("line");
		attr(line, {
			class: "bpmn-ghost-conn",
			x1: srcCx,
			y1: srcCy,
			x2: end.x,
			y2: end.y,
			"marker-end": `url(#${this._markerId})`,
		});
		this._ghostConnG.appendChild(line);
	}

	// ── Ghost create shape ─────────────────────────────────────────────

	setGhostCreate(type: CreateShapeType | null, diag?: DiagPoint): void {
		this._ghostCreateG.innerHTML = "";
		if (!type || !diag) return;

		const bounds = defaultBoundsForType(type, diag.x, diag.y);
		const { x, y, width, height } = bounds;

		const g = svgEl("g");
		attr(g, { class: "bpmn-ghost", transform: `translate(${x} ${y})` });

		if (type === "startEvent" || type === "endEvent") {
			const cx = width / 2;
			const cy = height / 2;
			const r = Math.min(cx, cy) - 1;
			const circle = svgEl("circle");
			attr(circle, {
				cx,
				cy,
				r,
				class: type === "endEvent" ? "bpmn-end-body" : "bpmn-event-body",
			});
			g.appendChild(circle);
		} else if (type === "exclusiveGateway" || type === "parallelGateway") {
			const cx = width / 2;
			const cy = height / 2;
			const diamond = svgEl("polygon");
			attr(diamond, {
				points: `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`,
				class: "bpmn-gw-body",
			});
			g.appendChild(diamond);
		} else {
			const rect = svgEl("rect");
			attr(rect, { x: 0, y: 0, width, height, rx: 10, class: "bpmn-shape-body" });
			g.appendChild(rect);
		}

		this._ghostCreateG.appendChild(g);
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultBoundsForType(
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
