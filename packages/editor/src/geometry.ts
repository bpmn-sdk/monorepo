import type { RenderedShape, ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnBounds, BpmnWaypoint } from "@bpmn-sdk/core";
import type { DiagPoint, HandleDir, PortDir } from "./types.js";

// ── Coordinate conversion ────────────────────────────────────────────────────

/**
 * Converts client (screen) coordinates to diagram coordinates accounting for
 * the current viewport transform.
 */
export function screenToDiagram(
	screenX: number,
	screenY: number,
	viewport: ViewportState,
	svgRect: DOMRect,
): DiagPoint {
	return {
		x: (screenX - svgRect.left - viewport.tx) / viewport.scale,
		y: (screenY - svgRect.top - viewport.ty) / viewport.scale,
	};
}

/**
 * Converts diagram coordinates to client (screen) coordinates.
 */
export function diagramToScreen(
	diagX: number,
	diagY: number,
	viewport: ViewportState,
	svgRect: DOMRect,
): { x: number; y: number } {
	return {
		x: diagX * viewport.scale + viewport.tx + svgRect.left,
		y: diagY * viewport.scale + viewport.ty + svgRect.top,
	};
}

// ── Hit testing ───────────────────────────────────────────────────────────────

/**
 * Returns the topmost shape that contains the diagram-space point (x, y),
 * or null if none. Iterates in reverse render order (last = top).
 */
export function hitTestShape(shapes: RenderedShape[], x: number, y: number): RenderedShape | null {
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		if (!shape) continue;
		const b = shape.shape.bounds;
		if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
			return shape;
		}
	}
	return null;
}

// ── Handle positions ──────────────────────────────────────────────────────────

/** Returns the 8 handle positions (diagram space) for a shape's bounding box. */
export function handlePositions(bounds: BpmnBounds): Record<HandleDir, DiagPoint> {
	const { x, y, width, height } = bounds;
	const cx = x + width / 2;
	const cy = y + height / 2;
	return {
		nw: { x, y },
		n: { x: cx, y },
		ne: { x: x + width, y },
		e: { x: x + width, y: cy },
		se: { x: x + width, y: y + height },
		s: { x: cx, y: y + height },
		sw: { x, y: y + height },
		w: { x, y: cy },
	};
}

// ── Port positions ────────────────────────────────────────────────────────────

/** Returns the 4 connection port positions (diagram space) for a shape. */
export function portPositions(bounds: BpmnBounds): Array<{ x: number; y: number; dir: PortDir }> {
	const { x, y, width, height } = bounds;
	return [
		{ x: x + width / 2, y, dir: "top" as PortDir },
		{ x: x + width, y: y + height / 2, dir: "right" as PortDir },
		{ x: x + width / 2, y: y + height, dir: "bottom" as PortDir },
		{ x, y: y + height / 2, dir: "left" as PortDir },
	];
}

// ── Resize ────────────────────────────────────────────────────────────────────

const MIN_SIZE = 20;

/**
 * Applies a resize handle drag to produce new bounds.
 * `diagX` and `diagY` are the current cursor position in diagram space.
 */
export function applyResize(
	original: BpmnBounds,
	handle: HandleDir,
	diagX: number,
	diagY: number,
): BpmnBounds {
	let { x, y, width, height } = original;
	const right = x + width;
	const bottom = y + height;

	switch (handle) {
		case "nw":
			x = Math.min(diagX, right - MIN_SIZE);
			y = Math.min(diagY, bottom - MIN_SIZE);
			width = right - x;
			height = bottom - y;
			break;
		case "n":
			y = Math.min(diagY, bottom - MIN_SIZE);
			height = bottom - y;
			break;
		case "ne":
			y = Math.min(diagY, bottom - MIN_SIZE);
			width = Math.max(diagX - x, MIN_SIZE);
			height = bottom - y;
			break;
		case "e":
			width = Math.max(diagX - x, MIN_SIZE);
			break;
		case "se":
			width = Math.max(diagX - x, MIN_SIZE);
			height = Math.max(diagY - y, MIN_SIZE);
			break;
		case "s":
			height = Math.max(diagY - y, MIN_SIZE);
			break;
		case "sw":
			x = Math.min(diagX, right - MIN_SIZE);
			width = right - x;
			height = Math.max(diagY - y, MIN_SIZE);
			break;
		case "w":
			x = Math.min(diagX, right - MIN_SIZE);
			width = right - x;
			break;
	}

	return { x, y, width, height };
}

// ── Waypoints ─────────────────────────────────────────────────────────────────

/**
 * Computes straight-line waypoints connecting the nearest edges of two bounds.
 */
export function computeWaypoints(src: BpmnBounds, tgt: BpmnBounds): BpmnWaypoint[] {
	const srcCx = src.x + src.width / 2;
	const srcCy = src.y + src.height / 2;
	const tgtCx = tgt.x + tgt.width / 2;
	const tgtCy = tgt.y + tgt.height / 2;

	// Find exit point on source boundary
	const srcPt = boundaryPoint(src, srcCx, srcCy, tgtCx, tgtCy);
	// Find entry point on target boundary
	const tgtPt = boundaryPoint(tgt, tgtCx, tgtCy, srcCx, srcCy);

	return [srcPt, tgtPt];
}

/** Returns the point where the line from (cx, cy) toward (tx, ty) exits bounds. */
function boundaryPoint(
	b: BpmnBounds,
	cx: number,
	cy: number,
	tx: number,
	ty: number,
): BpmnWaypoint {
	const dx = tx - cx;
	const dy = ty - cy;
	if (dx === 0 && dy === 0) return { x: cx, y: cy };

	const hw = b.width / 2;
	const hh = b.height / 2;

	// Intersect with each edge; pick closest intersection in the direction of travel
	let tBest = Number.POSITIVE_INFINITY;
	let best = { x: cx, y: cy };

	const tryT = (t: number, px: number, py: number): void => {
		if (t < 0 || t > 1 + 1e-9) return;
		if (t < tBest) {
			tBest = t;
			best = { x: px, y: py };
		}
	};

	// Right edge: cx + hw
	if (dx !== 0) {
		const t = hw / Math.abs(dx);
		if (dx > 0) tryT(t, cx + hw, cy + dy * t);
		else tryT(-hw / dx, cx - hw, cy - dy * (hw / dx) * -1);
	}
	// Left edge: cx - hw
	if (dx !== 0) {
		const tL = -hw / dx;
		if (tL >= 0) tryT(tL, cx - hw, cy + dy * tL);
	}
	// Bottom edge: cy + hh
	if (dy !== 0) {
		const t = hh / Math.abs(dy);
		if (dy > 0) tryT(t, cx + dx * t, cy + hh);
		else tryT(-hh / dy, cx + dx * (-hh / dy), cy - hh);
	}
	// Top edge: cy - hh
	if (dy !== 0) {
		const tT = -hh / dy;
		if (tT >= 0) tryT(tT, cx + dx * tT, cy - hh);
	}

	return best;
}

// ── Selection bounds ──────────────────────────────────────────────────────────

/**
 * Returns the bounding box that encloses all selected shapes, or null if none.
 */
export function selectionBounds(shapes: RenderedShape[], ids: string[]): BpmnBounds | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;

	for (const shape of shapes) {
		if (!ids.includes(shape.id)) continue;
		found = true;
		const { x, y, width, height } = shape.shape.bounds;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + width);
		maxY = Math.max(maxY, y + height);
	}

	if (!found) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
