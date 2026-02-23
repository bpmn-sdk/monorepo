import type { RenderedShape, ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnBounds, BpmnWaypoint } from "@bpmn-sdk/core";
import type { DiagPoint, HandleDir, LabelPosition, PortDir } from "./types.js";

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
 * Computes orthogonal (H/V only) waypoints between two shapes.
 * Produces a Z-shaped path: exit right of source → mid-x column → enter left of target.
 * When centers share the same Y, produces a straight horizontal segment.
 */
export function computeWaypoints(src: BpmnBounds, tgt: BpmnBounds): BpmnWaypoint[] {
	const srcRight = src.x + src.width;
	const srcCy = src.y + src.height / 2;
	const tgtLeft = tgt.x;
	const tgtCy = tgt.y + tgt.height / 2;

	// Same Y center → straight horizontal
	if (Math.abs(srcCy - tgtCy) < 2) {
		return [
			{ x: srcRight, y: srcCy },
			{ x: tgtLeft, y: tgtCy },
		];
	}

	// Target to the right (normal layout) → Z-shape through midpoint column
	if (tgtLeft >= srcRight - 20) {
		const midX = Math.round((srcRight + tgtLeft) / 2);
		return [
			{ x: srcRight, y: srcCy },
			{ x: midX, y: srcCy },
			{ x: midX, y: tgtCy },
			{ x: tgtLeft, y: tgtCy },
		];
	}

	// Target to the left or overlapping → loop out to the right
	const loopX = Math.max(srcRight, tgt.x + tgt.width) + 50;
	return [
		{ x: srcRight, y: srcCy },
		{ x: loopX, y: srcCy },
		{ x: loopX, y: tgtCy },
		{ x: tgtLeft, y: tgtCy },
	];
}

// ── Label position ────────────────────────────────────────────────────────────

const LABEL_W = 80;
const LABEL_H = 20;
const LABEL_GAP = 6;

/**
 * Computes the absolute diagram-space bounds for an external label given a
 * position option and the shape it belongs to.
 */
export function labelBoundsForPosition(shape: BpmnBounds, position: LabelPosition): BpmnBounds {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const right = shape.x + shape.width;
	const bottom = shape.y + shape.height;
	switch (position) {
		case "bottom":
			return { x: cx - LABEL_W / 2, y: bottom + LABEL_GAP, width: LABEL_W, height: LABEL_H };
		case "top":
			return {
				x: cx - LABEL_W / 2,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			};
		case "left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: cy - LABEL_H / 2,
				width: LABEL_W,
				height: LABEL_H,
			};
		case "right":
			return { x: right + LABEL_GAP, y: cy - LABEL_H / 2, width: LABEL_W, height: LABEL_H };
		case "bottom-left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: bottom + LABEL_GAP,
				width: LABEL_W,
				height: LABEL_H,
			};
		case "bottom-right":
			return { x: right + LABEL_GAP, y: bottom + LABEL_GAP, width: LABEL_W, height: LABEL_H };
		case "top-left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			};
		case "top-right":
			return {
				x: right + LABEL_GAP,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			};
	}
}

// ── Port helpers ──────────────────────────────────────────────────────────────

/** Returns the midpoint of a specific port edge in diagram space. */
export function portPoint(bounds: BpmnBounds, port: PortDir): DiagPoint {
	const { x, y, width, height } = bounds;
	switch (port) {
		case "top":
			return { x: x + width / 2, y };
		case "right":
			return { x: x + width, y: y + height / 2 };
		case "bottom":
			return { x: x + width / 2, y: y + height };
		case "left":
			return { x, y: y + height / 2 };
	}
}

/** Returns which port of `bounds` is nearest to `pos` in diagram space. */
export function closestPort(pos: DiagPoint, bounds: BpmnBounds): PortDir {
	const dirs: PortDir[] = ["top", "right", "bottom", "left"];
	let best: PortDir = "right";
	let minDist = Number.POSITIVE_INFINITY;
	for (const dir of dirs) {
		const pt = portPoint(bounds, dir);
		const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
		if (d < minDist) {
			minDist = d;
			best = dir;
		}
	}
	return best;
}

/**
 * Derives which port of `bounds` a waypoint exits from / enters at.
 * Uses the dominant axis between the waypoint and the shape centre.
 */
export function portFromWaypoint(wp: BpmnWaypoint, bounds: BpmnBounds): PortDir {
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const dx = wp.x - cx;
	const dy = wp.y - cy;
	const hw = bounds.width / 2;
	const hh = bounds.height / 2;
	// Normalise to unit aspect ratio so thin shapes behave correctly
	if (Math.abs(dx / hw) >= Math.abs(dy / hh)) {
		return dx >= 0 ? "right" : "left";
	}
	return dy >= 0 ? "bottom" : "top";
}

/**
 * Computes orthogonal waypoints connecting two shapes via explicit exit/entry
 * ports.  All segments are horizontal or vertical.
 */
export function computeWaypointsWithPorts(
	src: BpmnBounds,
	srcPort: PortDir,
	tgt: BpmnBounds,
	tgtPort: PortDir,
): BpmnWaypoint[] {
	const E = portPoint(src, srcPort);
	const P = portPoint(tgt, tgtPort);

	if (Math.hypot(E.x - P.x, E.y - P.y) < 2) return [E, P];

	const srcH = srcPort === "left" || srcPort === "right";
	const tgtH = tgtPort === "left" || tgtPort === "right";

	if (srcH && tgtH) {
		if (Math.abs(E.y - P.y) < 2) return [E, P];
		if (srcPort === tgtPort) {
			// Same-direction ports → U-route
			const loopX = srcPort === "right" ? Math.max(E.x, P.x) + 50 : Math.min(E.x, P.x) - 50;
			return [E, { x: loopX, y: E.y }, { x: loopX, y: P.y }, P];
		}
		const midX = Math.round((E.x + P.x) / 2);
		return [E, { x: midX, y: E.y }, { x: midX, y: P.y }, P];
	}

	if (!srcH && !tgtH) {
		if (Math.abs(E.x - P.x) < 2) return [E, P];
		if (srcPort === tgtPort) {
			const loopY = srcPort === "bottom" ? Math.max(E.y, P.y) + 50 : Math.min(E.y, P.y) - 50;
			return [E, { x: E.x, y: loopY }, { x: P.x, y: loopY }, P];
		}
		const midY = Math.round((E.y + P.y) / 2);
		return [E, { x: E.x, y: midY }, { x: P.x, y: midY }, P];
	}

	if (srcH && !tgtH) {
		// Horizontal exit → vertical entry: L-route
		return [E, { x: P.x, y: E.y }, P];
	}
	// Vertical exit → horizontal entry: L-route
	return [E, { x: E.x, y: P.y }, P];
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
