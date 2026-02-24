import type { CreateShapeType, LabelPosition } from "./types.js";

export interface ElementGroup {
	id: string;
	title: string;
	defaultType: CreateShapeType;
	types: ReadonlyArray<CreateShapeType>;
}

export const ELEMENT_GROUPS: ReadonlyArray<ElementGroup> = [
	{
		id: "events",
		title: "Events",
		defaultType: "startEvent",
		types: ["startEvent", "endEvent"],
	},
	{
		id: "activities",
		title: "Activities",
		defaultType: "serviceTask",
		types: ["serviceTask", "userTask", "scriptTask", "sendTask", "receiveTask", "businessRuleTask"],
	},
	{
		id: "gateways",
		title: "Gateways",
		defaultType: "exclusiveGateway",
		types: ["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway"],
	},
];

const _typeToGroup = new Map<CreateShapeType, ElementGroup>();
for (const group of ELEMENT_GROUPS) {
	for (const type of group.types) {
		_typeToGroup.set(type, group);
	}
}

export function getElementGroup(type: CreateShapeType): ElementGroup | undefined {
	return _typeToGroup.get(type);
}

export const ELEMENT_TYPE_LABELS: Readonly<Record<CreateShapeType, string>> = {
	startEvent: "Start Event",
	endEvent: "End Event",
	serviceTask: "Service Task",
	userTask: "User Task",
	scriptTask: "Script Task",
	sendTask: "Send Task",
	receiveTask: "Receive Task",
	businessRuleTask: "Business Rule Task",
	exclusiveGateway: "Exclusive Gateway",
	parallelGateway: "Parallel Gateway",
	inclusiveGateway: "Inclusive Gateway",
	eventBasedGateway: "Event-based Gateway",
};

export const EXTERNAL_LABEL_TYPES: ReadonlySet<CreateShapeType> = new Set([
	"startEvent",
	"endEvent",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
]);

export const CONTEXTUAL_ADD_TYPES: ReadonlyArray<CreateShapeType> = [
	"serviceTask",
	"exclusiveGateway",
	"endEvent",
];

export function getValidLabelPositions(type: CreateShapeType): ReadonlyArray<LabelPosition> {
	const base: LabelPosition[] = ["bottom", "top", "left", "right"];
	if (
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway"
	) {
		return [...base, "bottom-left", "bottom-right", "top-left", "top-right"];
	}
	return base;
}
