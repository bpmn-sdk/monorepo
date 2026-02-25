import type { CanvasEvents, CanvasOptions } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";

export type CreateShapeType =
	| "startEvent"
	| "endEvent"
	| "intermediateThrowEvent"
	| "intermediateCatchEvent"
	| "task"
	| "serviceTask"
	| "userTask"
	| "scriptTask"
	| "sendTask"
	| "receiveTask"
	| "businessRuleTask"
	| "manualTask"
	| "callActivity"
	| "subProcess"
	| "transaction"
	| "exclusiveGateway"
	| "parallelGateway"
	| "inclusiveGateway"
	| "eventBasedGateway"
	| "complexGateway"
	| "textAnnotation";

/** Element types that support resize handles. */
export const RESIZABLE_TYPES: ReadonlySet<string> = new Set([
	"task",
	"serviceTask",
	"userTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"subProcess",
	"transaction",
	"textAnnotation",
]);

export type Tool = "select" | "pan" | "space" | `create:${CreateShapeType}`;

export type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type PortDir = "top" | "right" | "bottom" | "left";

export type EditorOptions = CanvasOptions;

export interface EditorEvents extends CanvasEvents {
	"diagram:change": (defs: BpmnDefinitions) => void;
	"editor:select": (ids: string[]) => void;
	"editor:tool": (tool: Tool) => void;
}

/** Label position options for events and gateways (external labels). */
export type LabelPosition =
	| "bottom"
	| "top"
	| "left"
	| "right"
	| "bottom-left"
	| "bottom-right"
	| "top-left"
	| "top-right";

export type HitResult =
	| { type: "canvas" }
	| { type: "shape"; id: string }
	| { type: "handle"; shapeId: string; handle: HandleDir }
	| { type: "port"; shapeId: string; port: PortDir }
	| { type: "edge"; id: string }
	| { type: "edge-endpoint"; edgeId: string; isStart: boolean };

export interface DiagPoint {
	x: number;
	y: number;
}
