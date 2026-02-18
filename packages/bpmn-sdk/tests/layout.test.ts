import { describe, expect, it } from "vitest";
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js";
import { assignCoordinates } from "../src/layout/coordinates.js";
import { minimizeCrossings } from "../src/layout/crossing.js";
import {
	buildGraph,
	detectBackEdges,
	reverseBackEdges,
	topologicalSort,
} from "../src/layout/graph.js";
import { assignLayers, groupByLayer } from "../src/layout/layers.js";
import { layoutProcess } from "../src/layout/layout-engine.js";
import { assertNoOverlap } from "../src/layout/overlap.js";
import { routeEdges } from "../src/layout/routing.js";
import type { LayoutResult } from "../src/layout/types.js";

// Helper: create a simple flow element with required fields
function node(id: string, type: BpmnFlowElement["type"] = "serviceTask"): BpmnFlowElement {
	const base = {
		id,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [],
		unknownAttributes: {},
	};
	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] };
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] };
		case "intermediateThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [] };
		case "intermediateCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [] };
		case "boundaryEvent":
			return { ...base, type: "boundaryEvent", attachedToRef: "", eventDefinitions: [] };
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" };
		case "parallelGateway":
			return { ...base, type: "parallelGateway" };
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" };
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" };
		case "callActivity":
			return { ...base, type: "callActivity" };
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		case "eventSubProcess":
			return {
				...base,
				type: "eventSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		default:
			return { ...base, type };
	}
}

// Helper: create a sequence flow
function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} };
}

// Helper: create a BpmnProcess
function proc(
	id: string,
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): BpmnProcess {
	return {
		id,
		flowElements,
		sequenceFlows,
		extensionElements: [],
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	};
}

describe("Graph utilities", () => {
	it("builds adjacency lists from nodes and flows", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);

		expect(graph.nodes).toEqual(["a", "b", "c"]);
		expect(graph.successors.get("a")).toEqual(["b"]);
		expect(graph.successors.get("b")).toEqual(["c"]);
		expect(graph.predecessors.get("c")).toEqual(["b"]);
	});

	it("detects back-edges in a cycle", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c"), flow("f3", "c", "a")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);

		expect(backEdges).toHaveLength(1);
		expect(backEdges[0]?.sourceRef).toBe("c");
		expect(backEdges[0]?.targetRef).toBe("a");
	});

	it("detects no back-edges in a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);

		expect(backEdges).toHaveLength(0);
	});

	it("reverses back-edges to create a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c"), flow("f3", "c", "a")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);
		const dag = reverseBackEdges(graph, backEdges);

		// c→a should be reversed to a→c
		expect(dag.successors.get("c")).toEqual([]);
		expect(dag.successors.get("a")).toContain("c");
	});

	it("topologically sorts a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const sorted = topologicalSort(graph);

		expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
		expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
	});
});

describe("Layer assignment", () => {
	it("assigns layers using longest-path", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);

		expect(layers.get("a")).toBe(0);
		expect(layers.get("b")).toBe(1);
		expect(layers.get("c")).toBe(2);
	});

	it("groups nodes by layer", () => {
		const nodes = [node("a"), node("b"), node("c"), node("d")];
		const flows = [
			flow("f1", "a", "b"),
			flow("f2", "a", "c"),
			flow("f3", "b", "d"),
			flow("f4", "c", "d"),
		];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);
		const groups = groupByLayer(layers);

		expect(groups[0]).toContain("a");
		expect(groups[1]).toContain("b");
		expect(groups[1]).toContain("c");
		expect(groups[2]).toContain("d");
	});
});

describe("Crossing minimization", () => {
	it("preserves all nodes after minimization", () => {
		const nodes = [node("a"), node("b"), node("c"), node("d")];
		const flows = [flow("f1", "a", "c"), flow("f2", "a", "d"), flow("f3", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);
		const groups = groupByLayer(layers);
		const result = minimizeCrossings(groups, graph);

		const allNodes = result.flat();
		expect(allNodes).toContain("a");
		expect(allNodes).toContain("b");
		expect(allNodes).toContain("c");
		expect(allNodes).toContain("d");
	});
});

describe("Coordinate assignment", () => {
	it("assigns coordinates with correct element sizes", () => {
		const flowNodes = [
			node("start", "startEvent"),
			node("task", "serviceTask"),
			node("end", "endEvent"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["start"], ["task"], ["end"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const startNode = result.find((n) => n.id === "start");
		const taskNode = result.find((n) => n.id === "task");
		const endNode = result.find((n) => n.id === "end");
		expect(startNode).toBeDefined();
		expect(taskNode).toBeDefined();
		expect(endNode).toBeDefined();
		if (!startNode || !taskNode || !endNode) return;

		expect(startNode.bounds.width).toBe(36);
		expect(startNode.bounds.height).toBe(36);
		expect(taskNode.bounds.width).toBe(100);
		expect(taskNode.bounds.height).toBe(80);
		expect(endNode.bounds.width).toBe(36);
		expect(endNode.bounds.height).toBe(36);
	});

	it("ensures horizontal spacing between layers", () => {
		const flowNodes = [node("start", "startEvent"), node("task", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["start"], ["task"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const startNode = result.find((n) => n.id === "start");
		const taskNode = result.find((n) => n.id === "task");
		expect(startNode).toBeDefined();
		expect(taskNode).toBeDefined();
		if (!startNode || !taskNode) return;

		// Task should be at least 80px (HORIZONTAL_SPACING) after start's right edge
		const startRight = startNode.bounds.x + startNode.bounds.width;
		expect(taskNode.bounds.x).toBeGreaterThanOrEqual(startRight + 80 - 1);
	});

	it("ensures vertical spacing between nodes in the same layer", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a", "b"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const nodeA = result.find((n) => n.id === "a");
		const nodeB = result.find((n) => n.id === "b");
		expect(nodeA).toBeDefined();
		expect(nodeB).toBeDefined();
		if (!nodeA || !nodeB) return;

		const gap = nodeB.bounds.y - (nodeA.bounds.y + nodeA.bounds.height);
		expect(gap).toBeGreaterThanOrEqual(60 - 1);
	});
});

describe("Edge routing", () => {
	it("routes forward edges with orthogonal segments", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a"], ["b"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
		const flows = [flow("f1", "a", "b")];
		const edges = routeEdges(flows, nodeMap, []);

		expect(edges).toHaveLength(1);
		const edge = edges[0];
		expect(edge).toBeDefined();
		if (!edge) return;
		expect(edge.waypoints.length).toBeGreaterThanOrEqual(2);

		// All segments should be orthogonal
		for (let i = 1; i < edge.waypoints.length; i++) {
			const prev = edge.waypoints[i - 1];
			const curr = edge.waypoints[i];
			if (!prev || !curr) continue;
			const isHorizontal = Math.abs(prev.y - curr.y) < 1;
			const isVertical = Math.abs(prev.x - curr.x) < 1;
			expect(isHorizontal || isVertical).toBe(true);
		}
	});

	it("routes back-edges above all nodes", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a"], ["b"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
		const flows = [flow("f1", "b", "a")];
		const backEdges = [{ flowId: "f1", sourceRef: "b", targetRef: "a" }];
		const edges = routeEdges(flows, nodeMap, backEdges);

		expect(edges).toHaveLength(1);
		const edge = edges[0];
		expect(edge).toBeDefined();
		if (!edge) return;

		// Back-edge should have waypoints above all nodes
		const minNodeY = Math.min(...layoutNodes.map((n) => n.bounds.y));
		const lowestWaypointY = Math.min(...edge.waypoints.map((w) => w.y));
		expect(lowestWaypointY).toBeLessThan(minNodeY);
	});
});

describe("Overlap assertion", () => {
	it("passes for non-overlapping elements", () => {
		const result: LayoutResult = {
			nodes: [
				{
					id: "a",
					type: "serviceTask",
					bounds: { x: 0, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 0,
				},
				{
					id: "b",
					type: "serviceTask",
					bounds: { x: 200, y: 0, width: 100, height: 80 },
					layer: 1,
					position: 0,
				},
			],
			edges: [],
		};

		expect(() => assertNoOverlap(result)).not.toThrow();
	});

	it("throws for overlapping elements", () => {
		const result: LayoutResult = {
			nodes: [
				{
					id: "a",
					type: "serviceTask",
					bounds: { x: 0, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 0,
				},
				{
					id: "b",
					type: "serviceTask",
					bounds: { x: 50, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 1,
				},
			],
			edges: [],
		};

		expect(() => assertNoOverlap(result)).toThrow(/overlap/i);
	});
});

describe("Layout engine (integration)", () => {
	it("lays out a simple linear process", () => {
		const process = proc(
			"process1",
			[node("start", "startEvent"), node("task1", "serviceTask"), node("end", "endEvent")],
			[flow("f1", "start", "task1"), flow("f2", "task1", "end")],
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(3);
		expect(result.edges).toHaveLength(2);

		// All edges should be orthogonal
		for (const edge of result.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const prev = edge.waypoints[i - 1];
				const curr = edge.waypoints[i];
				if (!prev || !curr) continue;
				const isHorizontal = Math.abs(prev.y - curr.y) < 1;
				const isVertical = Math.abs(prev.x - curr.x) < 1;
				expect(isHorizontal || isVertical).toBe(true);
			}
		}
	});

	it("lays out a process with exclusive gateway branching", () => {
		const process = proc(
			"process2",
			[
				node("start", "startEvent"),
				node("gw1", "exclusiveGateway"),
				node("taskA", "serviceTask"),
				node("taskB", "serviceTask"),
				node("gw2", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "gw1"),
				flow("f2", "gw1", "taskA"),
				flow("f3", "gw1", "taskB"),
				flow("f4", "taskA", "gw2"),
				flow("f5", "taskB", "gw2"),
				flow("f6", "gw2", "end"),
			],
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(6);
		expect(result.edges).toHaveLength(6);

		// taskA and taskB should be in the same layer (column) at different y positions
		const taskA = result.nodes.find((n) => n.id === "taskA");
		const taskB = result.nodes.find((n) => n.id === "taskB");
		expect(taskA).toBeDefined();
		expect(taskB).toBeDefined();
		if (!taskA || !taskB) return;
		expect(taskA.layer).toBe(taskB.layer);
		expect(taskA.bounds.y).not.toBe(taskB.bounds.y);
	});

	it("lays out a process with a loop (back-edge)", () => {
		const process = proc(
			"process3",
			[
				node("start", "startEvent"),
				node("task", "serviceTask"),
				node("gw", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "task"),
				flow("f2", "task", "gw"),
				flow("f3", "gw", "end"),
				flow("f4", "gw", "task"), // loop back
			],
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(4);
		expect(result.edges).toHaveLength(4);

		// The back-edge should route above other elements
		const backEdge = result.edges.find((e) => e.id === "f4");
		expect(backEdge).toBeDefined();
		if (!backEdge) return;
		expect(backEdge.waypoints.length).toBeGreaterThan(2);
	});

	it("lays out a 9-branch exclusive gateway", () => {
		const branches = Array.from({ length: 9 }, (_, i) => `branch${i}`);
		const process = proc(
			"process4",
			[
				node("start", "startEvent"),
				node("gw1", "exclusiveGateway"),
				...branches.map((b) => node(b, "callActivity")),
				node("gw2", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f0", "start", "gw1"),
				...branches.map((b, i) => flow(`fb${i}`, "gw1", b)),
				...branches.map((b, i) => flow(`fm${i}`, b, "gw2")),
				flow("fend", "gw2", "end"),
			],
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(13); // start + gw1 + 9 branches + gw2 + end
		expect(result.edges).toHaveLength(20); // f0 + 9 fan-out + 9 fan-in + fend

		// All 9 branches should be in the same layer
		const branchNodes = result.nodes.filter((n) => n.id.startsWith("branch"));
		const branchLayers = new Set(branchNodes.map((n) => n.layer));
		expect(branchLayers.size).toBe(1);

		// No overlaps
		expect(() => assertNoOverlap(result)).not.toThrow();
	});

	it("lays out a process with parallel gateway", () => {
		const process = proc(
			"process5",
			[
				node("start", "startEvent"),
				node("fork", "parallelGateway"),
				node("taskA", "serviceTask"),
				node("taskB", "serviceTask"),
				node("join", "parallelGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "fork"),
				flow("f2", "fork", "taskA"),
				flow("f3", "fork", "taskB"),
				flow("f4", "taskA", "join"),
				flow("f5", "taskB", "join"),
				flow("f6", "join", "end"),
			],
		);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(6);
		expect(() => assertNoOverlap(result)).not.toThrow();
	});

	it("lays out a process with named elements (label bounds)", () => {
		const namedStart = node("start", "startEvent");
		namedStart.name = "Begin";
		const namedGw = node("gw", "exclusiveGateway");
		namedGw.name = "Decision";

		const process = proc(
			"process6",
			[namedStart, node("task", "serviceTask"), namedGw, node("end", "endEvent")],
			[flow("f1", "start", "task"), flow("f2", "task", "gw"), flow("f3", "gw", "end")],
		);

		const result = layoutProcess(process);

		const startNode = result.nodes.find((n) => n.id === "start");
		const gwNode = result.nodes.find((n) => n.id === "gw");
		expect(startNode).toBeDefined();
		expect(gwNode).toBeDefined();
		if (!startNode || !gwNode) return;

		// Start event label should be below the element
		expect(startNode.labelBounds).toBeDefined();
		expect(startNode.labelBounds?.y).toBeGreaterThan(startNode.bounds.y + startNode.bounds.height);

		// Gateway label should be above the element
		expect(gwNode.labelBounds).toBeDefined();
		expect(gwNode.labelBounds?.y).toBeLessThan(gwNode.bounds.y);
	});

	it("lays out a sub-process with children", () => {
		const subprocess = node("sub", "adHocSubProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[];
			sequenceFlows: BpmnSequenceFlow[];
		};
		subprocess.flowElements = [node("child1", "serviceTask"), node("child2", "serviceTask")];
		subprocess.sequenceFlows = [flow("cf1", "child1", "child2")];

		const process = proc(
			"process7",
			[node("start", "startEvent"), subprocess, node("end", "endEvent")],
			[flow("f1", "start", "sub"), flow("f2", "sub", "end")],
		);

		const result = layoutProcess(process);

		// Should contain parent nodes + child nodes
		const parentNode = result.nodes.find((n) => n.id === "sub");
		expect(parentNode).toBeDefined();
		if (!parentNode) return;
		// Sub-process should be sized to contain its children
		expect(parentNode.bounds.width).toBeGreaterThan(100);
		expect(parentNode.bounds.height).toBeGreaterThan(80);

		// Child nodes should be positioned within the sub-process
		const child1 = result.nodes.find((n) => n.id === "child1");
		const child2 = result.nodes.find((n) => n.id === "child2");
		expect(child1).toBeDefined();
		expect(child2).toBeDefined();
		if (!child1 || !child2) return;
		expect(child1.bounds.x).toBeGreaterThanOrEqual(parentNode.bounds.x);
		expect(child1.bounds.y).toBeGreaterThanOrEqual(parentNode.bounds.y);
	});

	it("handles an empty process", () => {
		const process = proc("empty", [], []);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(0);
		expect(result.edges).toHaveLength(0);
	});

	it("handles disconnected nodes", () => {
		const process = proc("disconnected", [node("a", "serviceTask"), node("b", "serviceTask")], []);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(2);
		expect(() => assertNoOverlap(result)).not.toThrow();
	});
});
