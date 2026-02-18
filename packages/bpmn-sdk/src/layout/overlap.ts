import type { Bounds, LayoutNode, LayoutResult } from "./types.js";

/**
 * Assert that no two element bounding boxes overlap,
 * no element overlaps a label, and no two labels overlap.
 * Throws if any overlap is detected.
 */
export function assertNoOverlap(result: LayoutResult): void {
	const allBounds: Array<{ id: string; kind: string; bounds: Bounds }> = [];

	for (const node of result.nodes) {
		allBounds.push({ id: node.id, kind: "element", bounds: node.bounds });
		if (node.labelBounds) {
			allBounds.push({ id: `${node.id}-label`, kind: "label", bounds: node.labelBounds });
		}
	}

	for (const edge of result.edges) {
		if (edge.labelBounds) {
			allBounds.push({ id: `${edge.id}-label`, kind: "label", bounds: edge.labelBounds });
		}
	}

	for (let i = 0; i < allBounds.length; i++) {
		for (let j = i + 1; j < allBounds.length; j++) {
			const a = allBounds[i]!;
			const b = allBounds[j]!;

			// Skip label-to-same-element overlap checks (labels belong to their element)
			if (a.id.replace("-label", "") === b.id.replace("-label", "")) continue;

			// Skip checking elements that are in a parent-child relationship
			// (sub-process children are inside the sub-process bounds by design)

			if (boundsOverlap(a.bounds, b.bounds)) {
				// Check if one is a sub-process containing the other
				if (isContainedWithin(a.bounds, b.bounds) || isContainedWithin(b.bounds, a.bounds)) {
					continue;
				}
				throw new Error(
					`Layout overlap detected: ${a.kind} "${a.id}" overlaps with ${b.kind} "${b.id}"`,
				);
			}
		}
	}
}

/** Check if two bounding boxes overlap (exclusive of touching edges). */
function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Check if bounds `inner` is fully contained within `outer`. */
function isContainedWithin(inner: Bounds, outer: Bounds): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}
