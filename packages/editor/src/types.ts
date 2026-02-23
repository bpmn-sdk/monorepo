import type { CanvasEvents, CanvasOptions } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";

export type CreateShapeType =
	| "startEvent"
	| "endEvent"
	| "serviceTask"
	| "userTask"
	| "exclusiveGateway"
	| "parallelGateway";

export type Tool = "select" | "pan" | `create:${CreateShapeType}`;

export type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type PortDir = "top" | "right" | "bottom" | "left";

export type EditorOptions = CanvasOptions;

export interface EditorEvents extends CanvasEvents {
	"diagram:change": (defs: BpmnDefinitions) => void;
	"editor:select": (ids: string[]) => void;
	"editor:tool": (tool: Tool) => void;
}

export type HitResult =
	| { type: "canvas" }
	| { type: "shape"; id: string }
	| { type: "handle"; shapeId: string; handle: HandleDir }
	| { type: "port"; shapeId: string; port: PortDir };

export interface DiagPoint {
	x: number;
	y: number;
}
