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
		types: ["startEvent", "endEvent", "intermediateThrowEvent", "intermediateCatchEvent"],
	},
	{
		id: "activities",
		title: "Activities",
		defaultType: "serviceTask",
		types: [
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
		],
	},
	{
		id: "gateways",
		title: "Gateways",
		defaultType: "exclusiveGateway",
		types: [
			"exclusiveGateway",
			"parallelGateway",
			"inclusiveGateway",
			"eventBasedGateway",
			"complexGateway",
		],
	},
	{
		id: "annotations",
		title: "Annotations",
		defaultType: "textAnnotation",
		types: ["textAnnotation"],
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
	intermediateThrowEvent: "Intermediate Throw Event",
	intermediateCatchEvent: "Intermediate Catch Event",
	task: "Task",
	serviceTask: "Service Task",
	userTask: "User Task",
	scriptTask: "Script Task",
	sendTask: "Send Task",
	receiveTask: "Receive Task",
	businessRuleTask: "Business Rule Task",
	manualTask: "Manual Task",
	callActivity: "Call Activity",
	subProcess: "Sub-Process",
	transaction: "Transaction",
	exclusiveGateway: "Exclusive Gateway",
	parallelGateway: "Parallel Gateway",
	inclusiveGateway: "Inclusive Gateway",
	eventBasedGateway: "Event-based Gateway",
	complexGateway: "Complex Gateway",
	textAnnotation: "Text Annotation",
};

export const EXTERNAL_LABEL_TYPES: ReadonlySet<CreateShapeType> = new Set([
	"startEvent",
	"endEvent",
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
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
		type === "eventBasedGateway" ||
		type === "complexGateway"
	) {
		return [...base, "bottom-left", "bottom-right", "top-left", "top-right"];
	}
	return base;
}
