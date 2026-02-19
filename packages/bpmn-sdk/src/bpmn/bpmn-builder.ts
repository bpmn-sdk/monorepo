import { layoutProcess } from "../layout/layout-engine.js";
import type { LayoutResult } from "../layout/types.js";
import { generateId } from "../types/id-generator.js";
import type { XmlElement } from "../types/xml-element.js";
import type {
	BpmnConditionExpression,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiPlane,
	BpmnDiShape,
	BpmnDiagram,
	BpmnElementType,
	BpmnError,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnProcess,
	BpmnSequenceFlow,
} from "./bpmn-model.js";
import type { RestConnectorConfig } from "./rest-connector.js";
import {
	restConnectorRetries,
	restConnectorTaskType,
	restConnectorToIoMappingInputs,
	restConnectorToTaskHeaders,
} from "./rest-connector.js";
import { type ZeebeExtensions, zeebeExtensionsToXmlElements } from "./zeebe-extensions.js";

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

/** Options shared by all element methods. */
export interface ElementOptions {
	name?: string;
}

/** Options for creating a start event. */
export interface StartEventOptions extends ElementOptions {
	/** Timer duration (ISO 8601) — creates a timer start event. */
	timerDuration?: string;
	/** Timer date (ISO 8601) — creates a timer start event. */
	timerDate?: string;
	/** Timer cycle (ISO 8601) — creates a timer start event. */
	timerCycle?: string;
	/** Message name — creates a message start event (aspirational). */
	messageName?: string;
}

/** Options for creating a service task. */
export interface ServiceTaskOptions {
	/** Display name. */
	name?: string;
	/** Zeebe job type for this task. */
	taskType: string;
	/** Number of retries (defaults to "3"). */
	retries?: string;
	/** Input/output variable mappings. */
	ioMapping?: {
		inputs?: Array<{ source: string; target: string }>;
		outputs?: Array<{ source: string; target: string }>;
	};
	/** Task header key-value pairs. */
	taskHeaders?: Record<string, string>;
	/** Zeebe modeler template ID. */
	modelerTemplate?: string;
	/** Zeebe modeler template version. */
	modelerTemplateVersion?: string;
	/** Zeebe modeler template icon (data URI). */
	modelerTemplateIcon?: string;
}

/** Options for creating a script task. */
export interface ScriptTaskOptions {
	/** Display name. */
	name?: string;
	/** FEEL expression for the script. */
	expression: string;
	/** Variable name to store the result. */
	resultVariable: string;
}

/** Options for creating a user task. */
export interface UserTaskOptions {
	/** Display name. */
	name?: string;
	/** Form key or form reference. */
	formId?: string;
}

/** Options for creating a call activity. */
export interface CallActivityOptions {
	/** Display name. */
	name?: string;
	/** Process ID to call. */
	processId: string;
	/** Whether to propagate all child variables. */
	propagateAllChildVariables?: boolean;
}

/** Options for creating a business rule task. */
export interface BusinessRuleTaskOptions {
	/** Display name. */
	name?: string;
	/** Zeebe job type. */
	taskType?: string;
	/** DMN decision ID to evaluate. */
	decisionId?: string;
	/** Variable to store the result. */
	resultVariable?: string;
}

/** Options for gateway elements. */
export interface GatewayOptions extends ElementOptions {
	/** ID of the default sequence flow (set manually; prefer branch().defaultFlow()). */
	defaultFlow?: string;
}

/** Options for an intermediate catch event. */
export interface IntermediateCatchEventOptions extends ElementOptions {
	/** Timer duration (ISO 8601) — creates a timer catch event. */
	timerDuration?: string;
	/** Timer date (ISO 8601) — creates a timer catch event that fires at a specific date/time. */
	timerDate?: string;
	/** Timer cycle (ISO 8601) — creates a recurring timer catch event. */
	timerCycle?: string;
	/** Message name — creates a message catch event (aspirational). */
	messageName?: string;
	/** Signal name — creates a signal catch event (aspirational). */
	signalName?: string;
}

/** Options for an intermediate throw event. */
export interface IntermediateThrowEventOptions extends ElementOptions {
	/** Message name — creates a message throw event (aspirational). */
	messageName?: string;
	/** Signal name — creates a signal throw event (aspirational). */
	signalName?: string;
	/** Escalation code — creates an escalation throw event (aspirational). */
	escalationCode?: string;
}

/** Options for a boundary event. */
export interface BoundaryEventOptions extends ElementOptions {
	/** ID of the activity this boundary event is attached to. */
	attachedTo: string;
	/** Whether the host activity is cancelled when the event triggers (default true). */
	cancelActivity?: boolean;
	/** Error code — creates an error boundary event. */
	errorCode?: string;
	/** Error reference ID. */
	errorRef?: string;
	/** Timer duration — creates a timer boundary event (aspirational). */
	timerDuration?: string;
	/** Timer date (ISO 8601) — creates a timer boundary event that fires at a specific date/time. */
	timerDate?: string;
	/** Timer cycle (ISO 8601) — creates a recurring timer boundary event. */
	timerCycle?: string;
	/** Message name — creates a message boundary event (aspirational). */
	messageName?: string;
	/** Signal name — creates a signal boundary event (aspirational). */
	signalName?: string;
}

/** Multi-instance loop configuration. */
export interface MultiInstanceOptions {
	isSequential?: boolean;
	collection?: string;
	elementVariable?: string;
	completionCondition?: string;
}

/** Options for sub-process elements. */
export interface SubProcessOptions extends ElementOptions {
	multiInstance?: MultiInstanceOptions;
}

/** Options for ad-hoc sub-process elements. */
export interface AdHocSubProcessOptions extends ElementOptions {
	/** FEEL expression for determining active elements. */
	activeElementsCollection?: string;
	/** Multi-instance loop configuration. */
	loopCharacteristics?: {
		inputCollection: string;
		inputElement?: string;
		outputCollection?: string;
		outputElement?: string;
	};
	multiInstance?: MultiInstanceOptions;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildEventDefinitions(
	opts: {
		timerDuration?: string;
		timerDate?: string;
		timerCycle?: string;
		errorCode?: string;
		errorRef?: string;
		messageName?: string;
		signalName?: string;
		escalationCode?: string;
	},
	rootErrors?: BpmnError[],
): BpmnEventDefinition[] {
	const defs: BpmnEventDefinition[] = [];
	if (opts.timerDuration || opts.timerDate || opts.timerCycle) {
		defs.push({
			type: "timer",
			timeDuration: opts.timerDuration,
			timeDate: opts.timerDate,
			timeCycle: opts.timerCycle,
		});
	}
	if (opts.errorCode !== undefined || opts.errorRef !== undefined) {
		let errorRef = opts.errorRef;
		if (!errorRef && opts.errorCode !== undefined && rootErrors) {
			const errorId = generateId("Error");
			rootErrors.push({ id: errorId, name: opts.errorCode, errorCode: opts.errorCode });
			errorRef = errorId;
		}
		defs.push({ type: "error", errorRef });
	}
	if (opts.messageName !== undefined) {
		defs.push({ type: "message", messageRef: opts.messageName });
	}
	if (opts.signalName !== undefined) {
		defs.push({ type: "signal", signalRef: opts.signalName });
	}
	if (opts.escalationCode !== undefined) {
		defs.push({ type: "escalation", escalationRef: opts.escalationCode });
	}
	return defs;
}

function makeFlowElement(
	id: string,
	type: BpmnElementType,
	options?: { name?: string; extensionElements?: XmlElement[] },
): BpmnFlowElement {
	const base = {
		id,
		name: options?.name,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: options?.extensionElements ?? [],
		unknownAttributes: {} as Record<string, string>,
	};

	switch (type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
			return { ...base, type, eventDefinitions: [] };
		case "boundaryEvent":
			return {
				...base,
				type: "boundaryEvent",
				attachedToRef: "",
				eventDefinitions: [],
			};
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "callActivity":
			return { ...base, type } as BpmnFlowElement;
		case "exclusiveGateway":
		case "inclusiveGateway":
			return { ...base, type } as BpmnFlowElement;
		case "parallelGateway":
		case "eventBasedGateway":
			return { ...base, type } as BpmnFlowElement;
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
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
	}
}

function buildMultiInstance(options: MultiInstanceOptions): BpmnMultiInstanceLoopCharacteristics {
	const extChildren: XmlElement[] = [];
	if (options.collection) {
		const attrs: Record<string, string> = {
			inputCollection: options.collection,
		};
		if (options.elementVariable) {
			attrs.inputElement = options.elementVariable;
		}
		extChildren.push({
			name: "zeebe:loopCharacteristics",
			attributes: attrs,
			children: [],
		});
	}
	return { extensionElements: extChildren };
}

function buildAdHocLoopCharacteristics(lc: {
	inputCollection: string;
	inputElement?: string;
	outputCollection?: string;
	outputElement?: string;
}): BpmnMultiInstanceLoopCharacteristics {
	const attrs: Record<string, string> = {
		inputCollection: lc.inputCollection,
	};
	if (lc.inputElement) attrs.inputElement = lc.inputElement;
	if (lc.outputCollection) attrs.outputCollection = lc.outputCollection;
	if (lc.outputElement) attrs.outputElement = lc.outputElement;

	return {
		extensionElements: [
			{
				name: "zeebe:loopCharacteristics",
				attributes: attrs,
				children: [],
			},
		],
	};
}

/** Convert a layout engine result into a BPMN diagram interchange structure. */
function layoutResultToDiagram(processId: string, layout: LayoutResult): BpmnDiagram {
	const shapes: BpmnDiShape[] = layout.nodes.map((node) => {
		const shape: BpmnDiShape = {
			id: `${node.id}_di`,
			bpmnElement: node.id,
			bounds: { ...node.bounds },
			unknownAttributes: {},
		};
		if (node.labelBounds) {
			shape.label = { bounds: { ...node.labelBounds } };
		}
		return shape;
	});

	const edges: BpmnDiEdge[] = layout.edges.map((edge) => {
		const diEdge: BpmnDiEdge = {
			id: `${edge.id}_di`,
			bpmnElement: edge.id,
			waypoints: edge.waypoints.map((wp) => ({ ...wp })),
			unknownAttributes: {},
		};
		if (edge.labelBounds) {
			diEdge.label = { bounds: { ...edge.labelBounds } };
		}
		return diEdge;
	});

	const plane: BpmnDiPlane = {
		id: `${processId}_di_plane`,
		bpmnElement: processId,
		shapes,
		edges,
	};

	return {
		id: `${processId}_di`,
		plane,
	};
}

function recomputeIncomingOutgoing(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
	for (const el of elements) {
		el.incoming = [];
		el.outgoing = [];
	}
	const elementMap = new Map(elements.map((el) => [el.id, el]));
	for (const flow of flows) {
		elementMap.get(flow.sourceRef)?.outgoing.push(flow.id);
		elementMap.get(flow.targetRef)?.incoming.push(flow.id);
	}
}

function buildServiceTaskExtensions(options: ServiceTaskOptions): XmlElement[] {
	const extensions: ZeebeExtensions = {
		taskDefinition: {
			type: options.taskType,
			retries: options.retries,
		},
	};

	if (options.ioMapping) {
		extensions.ioMapping = {
			inputs: options.ioMapping.inputs ?? [],
			outputs: options.ioMapping.outputs ?? [],
		};
	}

	if (options.taskHeaders) {
		extensions.taskHeaders = {
			headers: Object.entries(options.taskHeaders).map(([key, value]) => ({
				key,
				value,
			})),
		};
	}

	return zeebeExtensionsToXmlElements(extensions);
}

function makeConditionExpression(expression: string): BpmnConditionExpression {
	return {
		text: expression,
		attributes: { "xsi:type": "bpmn:tFormalExpression" },
	};
}

// ---------------------------------------------------------------------------
// Branch builder (used inside gateway branch callbacks)
// ---------------------------------------------------------------------------

/**
 * Builder for a single named branch path from a gateway.
 *
 * Use `.condition(expr)` to set a FEEL condition on the outgoing sequence
 * flow from the gateway, or `.defaultFlow()` to mark it as the default path.
 */
export class BranchBuilder {
	/** @internal */
	readonly _elements: BpmnFlowElement[] = [];
	/** @internal */
	readonly _flows: BpmnSequenceFlow[] = [];
	/** @internal */
	_defaultFlowId: string | undefined;
	private lastNodeId: string;
	private readonly gatewayId: string;
	private readonly branchName: string;
	private isFirstElement = true;
	private pendingCondition: string | undefined;
	private pendingDefault = false;

	/** @internal */
	constructor(gatewayId: string, branchName: string) {
		this.gatewayId = gatewayId;
		this.branchName = branchName;
		this.lastNodeId = gatewayId;
	}

	/** Set a FEEL condition expression on this branch's outgoing sequence flow. */
	condition(expression: string): this {
		this.pendingCondition = expression;
		return this;
	}

	/** Mark this branch as the gateway's default (no-condition) flow. */
	defaultFlow(): this {
		this.pendingDefault = true;
		return this;
	}

	private addElement(element: BpmnFlowElement): this {
		this._elements.push(element);
		const flowId = generateId("Flow");
		const flow: BpmnSequenceFlow = {
			id: flowId,
			sourceRef: this.lastNodeId,
			targetRef: element.id,
			name: this.isFirstElement ? this.branchName : undefined,
			conditionExpression:
				this.isFirstElement && this.pendingCondition
					? makeConditionExpression(this.pendingCondition)
					: undefined,
			extensionElements: [],
			unknownAttributes: {},
		};
		this._flows.push(flow);

		if (this.isFirstElement && this.pendingDefault) {
			this._defaultFlowId = flowId;
		}

		this.isFirstElement = false;
		this.lastNodeId = element.id;
		return this;
	}

	/**
	 * Connect the current position to an existing or future element by ID.
	 * Supports forward references (element created later) and backward references (loops).
	 */
	connectTo(targetId: string): this {
		const flowId = generateId("Flow");
		const flow: BpmnSequenceFlow = {
			id: flowId,
			sourceRef: this.lastNodeId,
			targetRef: targetId,
			name: this.isFirstElement ? this.branchName : undefined,
			conditionExpression:
				this.isFirstElement && this.pendingCondition
					? makeConditionExpression(this.pendingCondition)
					: undefined,
			extensionElements: [],
			unknownAttributes: {},
		};
		this._flows.push(flow);

		if (this.isFirstElement && this.pendingDefault) {
			this._defaultFlowId = flowId;
		}

		this.isFirstElement = false;
		this.lastNodeId = targetId;
		return this;
	}

	// ---- Flow-node methods (mirror ProcessBuilder) ----

	serviceTask(id: string, options: ServiceTaskOptions): this {
		const unknownAttributes: Record<string, string> = {};
		if (options.modelerTemplate)
			unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate;
		if (options.modelerTemplateVersion)
			unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion;
		if (options.modelerTemplateIcon)
			unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon;

		const el = makeFlowElement(id, "serviceTask", {
			name: options.name,
			extensionElements: buildServiceTaskExtensions(options),
		});
		el.unknownAttributes = unknownAttributes;
		return this.addElement(el);
	}

	userTask(id: string, options?: UserTaskOptions): this {
		const ext = options?.formId
			? zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:formDefinition",
							attributes: { formId: options.formId },
							children: [],
						},
					],
				})
			: [];
		return this.addElement(
			makeFlowElement(id, "userTask", {
				name: options?.name,
				extensionElements: ext,
			}),
		);
	}

	scriptTask(id: string, options: ScriptTaskOptions): this {
		return this.addElement(
			makeFlowElement(id, "scriptTask", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:script",
							attributes: {
								expression: options.expression,
								resultVariable: options.resultVariable,
							},
							children: [],
						},
					],
				}),
			}),
		);
	}

	sendTask(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "sendTask", options));
	}

	receiveTask(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "receiveTask", options));
	}

	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		const ext: XmlElement[] = [];
		if (options?.decisionId) {
			ext.push({
				name: "zeebe:calledDecision",
				attributes: {
					decisionId: options.decisionId,
					resultVariable: options.resultVariable ?? "result",
				},
				children: [],
			});
		}
		return this.addElement(
			makeFlowElement(id, "businessRuleTask", {
				name: options?.name,
				extensionElements: ext,
			}),
		);
	}

	callActivity(id: string, options: CallActivityOptions): this {
		const attrs: Record<string, string> = { processId: options.processId };
		if (options.propagateAllChildVariables !== undefined) {
			attrs.propagateAllChildVariables = String(options.propagateAllChildVariables);
		}
		return this.addElement(
			makeFlowElement(id, "callActivity", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:calledElement",
							attributes: attrs,
							children: [],
						},
					],
				}),
			}),
		);
	}

	startEvent(id?: string, options?: StartEventOptions): this {
		const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options);
		if (
			el.type === "startEvent" &&
			(options?.timerDuration || options?.timerCycle || options?.timerDate)
		) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}

	endEvent(id?: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id ?? generateId("EndEvent"), "endEvent", options));
	}

	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateThrowEvent"),
			"intermediateThrowEvent",
			options,
		);
		if (el.type === "intermediateThrowEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}

	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateCatchEvent"),
			"intermediateCatchEvent",
			options,
		);
		if (el.type === "intermediateCatchEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}

	exclusiveGateway(id: string, options?: GatewayOptions): this {
		const el = makeFlowElement(id, "exclusiveGateway", options);
		if (options?.defaultFlow && el.type === "exclusiveGateway") {
			(el as { default?: string }).default = options.defaultFlow;
		}
		return this.addElement(el);
	}

	parallelGateway(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "parallelGateway", options));
	}

	inclusiveGateway(id: string, options?: GatewayOptions): this {
		const el = makeFlowElement(id, "inclusiveGateway", options);
		if (options?.defaultFlow && el.type === "inclusiveGateway") {
			(el as { default?: string }).default = options.defaultFlow;
		}
		return this.addElement(el);
	}

	eventBasedGateway(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "eventBasedGateway", options));
	}
}

// ---------------------------------------------------------------------------
// Sub-process content builder
// ---------------------------------------------------------------------------

/** Builder for the contents of a sub-process or ad-hoc sub-process. */
export class SubProcessContentBuilder {
	/** @internal */
	readonly _elements: BpmnFlowElement[] = [];
	/** @internal */
	readonly _flows: BpmnSequenceFlow[] = [];
	private lastNodeId: string | undefined;

	private addElement(element: BpmnFlowElement): this {
		this._elements.push(element);
		if (this.lastNodeId) {
			const flowId = generateId("Flow");
			this._flows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			});
		}
		this.lastNodeId = element.id;
		return this;
	}

	startEvent(id?: string, options?: StartEventOptions): this {
		const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options);
		if (el.type === "startEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}

	endEvent(id?: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id ?? generateId("EndEvent"), "endEvent", options));
	}

	serviceTask(id: string, options: ServiceTaskOptions): this {
		return this.addElement(
			makeFlowElement(id, "serviceTask", {
				name: options.name,
				extensionElements: buildServiceTaskExtensions(options),
			}),
		);
	}

	userTask(id: string, options?: UserTaskOptions): this {
		return this.addElement(makeFlowElement(id, "userTask", { name: options?.name }));
	}

	scriptTask(id: string, options: ScriptTaskOptions): this {
		return this.addElement(
			makeFlowElement(id, "scriptTask", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:script",
							attributes: {
								expression: options.expression,
								resultVariable: options.resultVariable,
							},
							children: [],
						},
					],
				}),
			}),
		);
	}

	callActivity(id: string, options: CallActivityOptions): this {
		const attrs: Record<string, string> = { processId: options.processId };
		if (options.propagateAllChildVariables !== undefined) {
			attrs.propagateAllChildVariables = String(options.propagateAllChildVariables);
		}
		return this.addElement(
			makeFlowElement(id, "callActivity", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:calledElement",
							attributes: attrs,
							children: [],
						},
					],
				}),
			}),
		);
	}

	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateThrowEvent"),
			"intermediateThrowEvent",
			options,
		);
		if (el.type === "intermediateThrowEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}

	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateCatchEvent"),
			"intermediateCatchEvent",
			options,
		);
		if (el.type === "intermediateCatchEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options);
		}
		return this.addElement(el);
	}
}

// ---------------------------------------------------------------------------
// Process builder (top-level entry point)
// ---------------------------------------------------------------------------

/** Fluent builder for constructing BPMN processes. */
export class ProcessBuilder {
	private readonly processId: string;
	private processName?: string;
	private _isExecutable = true;
	private _versionTag?: string;
	private readonly flowElements: BpmnFlowElement[] = [];
	private readonly sequenceFlows: BpmnSequenceFlow[] = [];
	private readonly rootErrors: BpmnError[] = [];
	private lastNodeId: string | undefined;
	private currentGatewayId: string | undefined;
	private _autoLayout = false;

	constructor(processId: string) {
		this.processId = processId;
	}

	/** Enable auto-layout: `build()` will run the layout engine and populate diagram interchange data. */
	withAutoLayout(): this {
		this._autoLayout = true;
		return this;
	}

	/** Set the display name for this process. */
	name(name: string): this {
		this.processName = name;
		return this;
	}

	/** Set whether this process is executable. */
	executable(value: boolean): this {
		this._isExecutable = value;
		return this;
	}

	/** Set the process version tag. */
	versionTag(tag: string): this {
		this._versionTag = tag;
		return this;
	}

	// ---- Events ----

	/** Add a start event. Start events never auto-connect from the previous element. */
	startEvent(id?: string, options?: StartEventOptions): this {
		const nodeId = id ?? generateId("StartEvent");
		const element = makeFlowElement(nodeId, "startEvent", options);
		if (element.type === "startEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(options);
		}
		this.addFlowElement(element);
		return this;
	}

	/**
	 * Add a disconnected start event — begins a new parallel path in the process.
	 *
	 * Unlike `startEvent()` which continues from the current position,
	 * `addStartEvent()` clears the current position first so the start event
	 * is completely disconnected.
	 */
	addStartEvent(id?: string, options?: StartEventOptions): this {
		this.lastNodeId = undefined;
		this.currentGatewayId = undefined;
		return this.startEvent(id, options);
	}

	/** Add an end event. */
	endEvent(id?: string, options?: ElementOptions): this {
		const nodeId = id ?? generateId("EndEvent");
		this.addFlowElement(makeFlowElement(nodeId, "endEvent", options));
		return this;
	}

	/** Add an intermediate throw event (none, message, signal, escalation). */
	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const nodeId = id ?? generateId("IntermediateThrowEvent");
		const element = makeFlowElement(nodeId, "intermediateThrowEvent", options);
		if (element.type === "intermediateThrowEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(options);
		}
		this.addFlowElement(element);
		return this;
	}

	/** Add an intermediate catch event (timer, message, signal). */
	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const nodeId = id ?? generateId("IntermediateCatchEvent");
		const element = makeFlowElement(nodeId, "intermediateCatchEvent", options);
		if (element.type === "intermediateCatchEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(options);
		}
		this.addFlowElement(element);
		return this;
	}

	/**
	 * Add a boundary event attached to an existing activity.
	 *
	 * Boundary events do not auto-connect from the previous element.
	 * They start a new outgoing chain from the boundary event itself.
	 */
	boundaryEvent(id: string, options: BoundaryEventOptions): this {
		const element = makeFlowElement(id, "boundaryEvent", options);
		if (element.type === "boundaryEvent") {
			element.attachedToRef = options.attachedTo;
			element.cancelActivity = options.cancelActivity;
			element.eventDefinitions = buildEventDefinitions(options, this.rootErrors);
		}
		// Boundary events never auto-connect — temporarily clear lastNodeId
		const prevLast = this.lastNodeId;
		this.lastNodeId = undefined;
		this.addFlowElement(element);
		// Don't restore prevLast — the builder now chains from the boundary event
		void prevLast;
		return this;
	}

	// ---- Tasks ----

	/** Add a service task with Zeebe task definition and optional IO mappings. */
	serviceTask(id: string, options: ServiceTaskOptions): this {
		const unknownAttributes: Record<string, string> = {};
		if (options.modelerTemplate)
			unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate;
		if (options.modelerTemplateVersion)
			unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion;
		if (options.modelerTemplateIcon)
			unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon;

		const el = makeFlowElement(id, "serviceTask", {
			name: options.name,
			extensionElements: buildServiceTaskExtensions(options),
		});
		el.unknownAttributes = unknownAttributes;
		this.addFlowElement(el);
		return this;
	}

	/** Add a REST connector task — syntactic sugar over `serviceTask()`. */
	restConnector(id: string, config: RestConnectorConfig): this {
		const inputs = restConnectorToIoMappingInputs(config);
		const taskHeaderEntries = restConnectorToTaskHeaders(config);

		const extensions: ZeebeExtensions = {
			taskDefinition: {
				type: restConnectorTaskType(),
				retries: restConnectorRetries(config),
			},
			ioMapping: { inputs, outputs: [] },
		};

		if (taskHeaderEntries.length > 0) {
			extensions.taskHeaders = { headers: taskHeaderEntries };
		}

		this.addFlowElement(
			makeFlowElement(id, "serviceTask", {
				extensionElements: zeebeExtensionsToXmlElements(extensions),
			}),
		);
		return this;
	}

	/** Add a script task with a FEEL expression. */
	scriptTask(id: string, options: ScriptTaskOptions): this {
		this.addFlowElement(
			makeFlowElement(id, "scriptTask", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:script",
							attributes: {
								expression: options.expression,
								resultVariable: options.resultVariable,
							},
							children: [],
						},
					],
				}),
			}),
		);
		return this;
	}

	/** Add a user task with optional form reference. */
	userTask(id: string, options?: UserTaskOptions): this {
		const extensionElements = options?.formId
			? zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:formDefinition",
							attributes: { formId: options.formId },
							children: [],
						},
					],
				})
			: [];
		this.addFlowElement(
			makeFlowElement(id, "userTask", {
				name: options?.name,
				extensionElements,
			}),
		);
		return this;
	}

	/** Add a send task (aspirational). */
	sendTask(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "sendTask", options));
		return this;
	}

	/** Add a receive task (aspirational). */
	receiveTask(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "receiveTask", options));
		return this;
	}

	/** Add a business rule task. */
	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		const ext: XmlElement[] = [];
		if (options?.taskType) {
			ext.push(
				...zeebeExtensionsToXmlElements({
					taskDefinition: { type: options.taskType },
				}),
			);
		}
		if (options?.decisionId) {
			ext.push({
				name: "zeebe:calledDecision",
				attributes: {
					decisionId: options.decisionId,
					resultVariable: options.resultVariable ?? "result",
				},
				children: [],
			});
		}
		this.addFlowElement(
			makeFlowElement(id, "businessRuleTask", {
				name: options?.name,
				extensionElements: ext,
			}),
		);
		return this;
	}

	/** Add a call activity referencing another process. */
	callActivity(id: string, options: CallActivityOptions): this {
		const attrs: Record<string, string> = {
			processId: options.processId,
		};
		if (options.propagateAllChildVariables !== undefined) {
			attrs.propagateAllChildVariables = String(options.propagateAllChildVariables);
		}
		this.addFlowElement(
			makeFlowElement(id, "callActivity", {
				name: options.name,
				extensionElements: zeebeExtensionsToXmlElements({
					unknownElements: [
						{
							name: "zeebe:calledElement",
							attributes: attrs,
							children: [],
						},
					],
				}),
			}),
		);
		return this;
	}

	// ---- Gateways ----

	/** Add an exclusive gateway (XOR split/join). */
	exclusiveGateway(id: string, options?: GatewayOptions): this {
		const element = makeFlowElement(id, "exclusiveGateway", options);
		if (options?.defaultFlow && element.type === "exclusiveGateway") {
			(element as { default?: string }).default = options.defaultFlow;
		}
		this.addFlowElement(element);
		this.currentGatewayId = id;
		return this;
	}

	/** Add a parallel gateway (AND split/join). */
	parallelGateway(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "parallelGateway", options));
		this.currentGatewayId = id;
		return this;
	}

	/** Add an inclusive gateway (OR split/join). Aspirational. */
	inclusiveGateway(id: string, options?: GatewayOptions): this {
		const element = makeFlowElement(id, "inclusiveGateway", options);
		if (options?.defaultFlow && element.type === "inclusiveGateway") {
			(element as { default?: string }).default = options.defaultFlow;
		}
		this.addFlowElement(element);
		this.currentGatewayId = id;
		return this;
	}

	/** Add an event-based gateway. Aspirational. */
	eventBasedGateway(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "eventBasedGateway", options));
		this.currentGatewayId = id;
		return this;
	}

	// ---- Branching & flow control ----

	/**
	 * Create a named branch from the current gateway.
	 *
	 * Each branch receives a {@link BranchBuilder} whose chain starts from
	 * the gateway. Use `.condition(expr)` or `.defaultFlow()` to configure
	 * the outgoing sequence flow, then chain flow-node methods, and finish
	 * with `.connectTo(targetId)` to merge into another element.
	 *
	 * @example
	 * ```ts
	 * .exclusiveGateway("check")
	 * .branch("yes", b => b.condition("= ok").serviceTask("do", { taskType: "x" }).connectTo("merge"))
	 * .branch("no", b => b.defaultFlow().serviceTask("fail", { taskType: "y" }).connectTo("merge"))
	 * .exclusiveGateway("merge")
	 * .endEvent("end")
	 * ```
	 */
	branch(name: string, callback: (b: BranchBuilder) => void): this {
		if (!this.currentGatewayId) {
			throw new Error("branch() must be called after a gateway element");
		}
		const b = new BranchBuilder(this.currentGatewayId, name);
		callback(b);

		for (const el of b._elements) {
			if (this.flowElements.some((n) => n.id === el.id)) {
				throw new Error(`Duplicate element ID "${el.id}"`);
			}
			this.flowElements.push(el);
		}
		for (const fl of b._flows) {
			this.sequenceFlows.push(fl);
		}

		// If the branch is the default flow, set the gateway's default
		if (b._defaultFlowId) {
			const gateway = this.flowElements.find((n) => n.id === this.currentGatewayId);
			if (gateway && (gateway.type === "exclusiveGateway" || gateway.type === "inclusiveGateway")) {
				gateway.default = b._defaultFlowId;
			}
		}

		this.lastNodeId = undefined;
		return this;
	}

	/** Connect the current position to an existing or future element by ID. */
	connectTo(targetId: string): this {
		if (this.lastNodeId) {
			const flowId = generateId("Flow");
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			});
		}
		this.lastNodeId = undefined;
		return this;
	}

	/**
	 * Position the builder at an existing element, allowing additional
	 * outgoing flows from any point in the graph.
	 *
	 * @throws If no element with the given ID exists.
	 */
	element(elementId: string): this {
		const found = this.flowElements.some((n) => n.id === elementId);
		if (!found) {
			throw new Error(`Element "${elementId}" not found in process "${this.processId}"`);
		}
		this.lastNodeId = elementId;
		this.currentGatewayId = undefined;
		return this;
	}

	// ---- Sub-processes ----

	/** Add an ad-hoc sub-process with optional multi-instance. */
	adHocSubProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: AdHocSubProcessOptions,
	): this {
		const sub = new SubProcessContentBuilder();
		content(sub);
		recomputeIncomingOutgoing(sub._elements, sub._flows);

		const extensionElements: XmlElement[] = [];
		if (options?.activeElementsCollection) {
			extensionElements.push({
				name: "zeebe:adHoc",
				attributes: {
					activeElementsCollection: options.activeElementsCollection,
				},
				children: [],
			});
		}

		const element = makeFlowElement(id, "adHocSubProcess", {
			name: options?.name,
			extensionElements,
		});
		if (element.type === "adHocSubProcess") {
			element.flowElements = sub._elements;
			element.sequenceFlows = sub._flows;
			if (options?.loopCharacteristics) {
				element.loopCharacteristics = buildAdHocLoopCharacteristics(options.loopCharacteristics);
			} else if (options?.multiInstance) {
				element.loopCharacteristics = buildMultiInstance(options.multiInstance);
			}
		}
		this.addFlowElement(element);
		return this;
	}

	/** Add a sub-process (aspirational). */
	subProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: SubProcessOptions,
	): this {
		const sub = new SubProcessContentBuilder();
		content(sub);
		recomputeIncomingOutgoing(sub._elements, sub._flows);

		const element = makeFlowElement(id, "subProcess", options);
		if (element.type === "subProcess") {
			element.flowElements = sub._elements;
			element.sequenceFlows = sub._flows;
			if (options?.multiInstance) {
				element.loopCharacteristics = buildMultiInstance(options.multiInstance);
			}
		}
		this.addFlowElement(element);
		return this;
	}

	/** Add an event sub-process (aspirational). */
	eventSubProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: ElementOptions,
	): this {
		const sub = new SubProcessContentBuilder();
		content(sub);
		recomputeIncomingOutgoing(sub._elements, sub._flows);

		const element = makeFlowElement(id, "eventSubProcess", options);
		if (element.type === "eventSubProcess") {
			element.flowElements = sub._elements;
			element.sequenceFlows = sub._flows;
		}
		this.addFlowElement(element);
		return this;
	}

	// ---- Build ----

	/**
	 * Build the complete BPMN definitions model.
	 *
	 * Resolves all forward-referenced `incoming` / `outgoing` arrays and wraps
	 * the process in a {@link BpmnDefinitions} ready for XML serialization.
	 */
	build(): BpmnDefinitions {
		recomputeIncomingOutgoing(this.flowElements, this.sequenceFlows);

		const extensionElements: XmlElement[] = [];
		if (this._versionTag) {
			extensionElements.push({
				name: "zeebe:versionTag",
				attributes: { value: this._versionTag },
				children: [],
			});
		}

		const process: BpmnProcess = {
			id: this.processId,
			name: this.processName,
			isExecutable: this._isExecutable,
			extensionElements,
			flowElements: this.flowElements,
			sequenceFlows: this.sequenceFlows,
			textAnnotations: [],
			associations: [],
			unknownAttributes: {},
		};

		return {
			id: "Definitions_1",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			exporter: "@urbanisierung/bpmn-sdk",
			exporterVersion: "0.0.1",
			namespaces: {
				bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
				bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
				dc: "http://www.omg.org/spec/DD/20100524/DC",
				di: "http://www.omg.org/spec/DD/20100524/DI",
				zeebe: "http://camunda.org/schema/zeebe/1.0",
				modeler: "http://camunda.org/schema/modeler/1.0",
				xsi: "http://www.w3.org/2001/XMLSchema-instance",
			},
			unknownAttributes: {
				"modeler:executionPlatform": "Camunda Cloud",
				"modeler:executionPlatformVersion": "8.6.0",
			},
			errors: this.rootErrors,
			escalations: [],
			collaborations: [],
			processes: [process],
			diagrams: this._autoLayout ? [this.buildDiagram(process)] : [],
		};
	}

	private buildDiagram(process: BpmnProcess): BpmnDiagram {
		const layoutResult = layoutProcess(process);
		return layoutResultToDiagram(this.processId, layoutResult);
	}

	// ---- Internal ----

	private addFlowElement(element: BpmnFlowElement): void {
		if (this.flowElements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`);
		}

		this.flowElements.push(element);

		if (this.lastNodeId) {
			const flowId = generateId("Flow");
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			});
		}

		this.lastNodeId = element.id;
	}
}
