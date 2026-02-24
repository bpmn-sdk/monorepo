/**
 * @bpmn-sdk/canvas-plugin-config-panel-bpmn — BPMN element schemas for the
 * config panel plugin.
 *
 * Registers config panel schemas for all standard BPMN element types,
 * including a full REST connector form for service tasks.
 *
 * ## Usage
 * ```typescript
 * import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
 * import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
 *
 * let editorRef: BpmnEditor | null = null;
 * const configPanel = createConfigPanelPlugin({
 *   getDefinitions: () => editorRef?.getDefinitions() ?? null,
 *   applyChange: (fn) => { editorRef?.applyChange(fn); },
 * });
 * const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel);
 * const editor = new BpmnEditor({ container, xml, plugins: [configPanel, configPanelBpmn] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import type {
	ConfigPanelPlugin,
	FieldValue,
	PanelAdapter,
	PanelSchema,
} from "@bpmn-sdk/canvas-plugin-config-panel";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { zeebeExtensionsToXmlElements } from "@bpmn-sdk/core";
import { ELEMENT_TYPE_LABELS } from "@bpmn-sdk/editor";
import type { CreateShapeType } from "@bpmn-sdk/editor";
import {
	findFlowElement,
	getIoInput,
	getTaskHeader,
	parseZeebeExtensions,
	updateFlowElement,
	xmlLocalName,
} from "./util.js";

// ── General schema (all flow element types) ───────────────────────────────────

const GENERAL_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Element name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Element name" },
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation for this element…",
				},
			],
		},
	],
};

const GENERAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => ({
			...el,
			name: typeof values.name === "string" ? values.name : el.name,
			documentation:
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation,
		}));
	},
};

// ── Service task schema ───────────────────────────────────────────────────────

const IS_REST_CONNECTOR = (values: Record<string, FieldValue>) =>
	values.taskType === "io.camunda:http-json:1";

const SERVICE_TASK_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
				{
					key: "taskType",
					label: "Task type",
					type: "text",
					placeholder: "io.camunda:http-json:1",
					hint: "Zeebe service type. REST connector: io.camunda:http-json:1",
				},
				{ key: "retries", label: "Retries", type: "text", placeholder: "3" },
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
		{
			id: "request",
			label: "Request",
			condition: IS_REST_CONNECTOR,
			fields: [
				{
					key: "method",
					label: "Method",
					type: "select",
					options: [
						{ value: "GET", label: "GET" },
						{ value: "POST", label: "POST" },
						{ value: "PUT", label: "PUT" },
						{ value: "PATCH", label: "PATCH" },
						{ value: "DELETE", label: "DELETE" },
					],
				},
				{
					key: "url",
					label: "URL",
					type: "text",
					placeholder: "https://api.example.com/endpoint",
					hint: "Prefix with = for a FEEL expression.",
				},
				{
					key: "headers",
					label: "Headers",
					type: "textarea",
					placeholder: '= { "Content-Type": "application/json" }',
					hint: "FEEL expression or leave blank.",
				},
				{
					key: "queryParameters",
					label: "Query parameters",
					type: "textarea",
					placeholder: '= { "page": 1, "limit": 10 }',
					hint: "FEEL expression or leave blank.",
				},
				{
					key: "body",
					label: "Body",
					type: "textarea",
					placeholder: '= { "orderId": orderId }',
					hint: "FEEL expression. Leave blank for GET / DELETE.",
				},
				{
					key: "connectionTimeoutInSeconds",
					label: "Connection timeout (s)",
					type: "text",
					placeholder: "20",
				},
				{
					key: "readTimeoutInSeconds",
					label: "Read timeout (s)",
					type: "text",
					placeholder: "20",
				},
			],
		},
		{
			id: "auth",
			label: "Authentication",
			condition: IS_REST_CONNECTOR,
			fields: [
				{
					key: "authType",
					label: "Type",
					type: "select",
					options: [
						{ value: "noAuth", label: "No authentication" },
						{ value: "bearer", label: "Bearer token" },
					],
				},
				{
					key: "authToken",
					label: "Bearer token",
					type: "text",
					placeholder: "secrets.MY_API_TOKEN",
					secret: true,
					hint: "Reference a Camunda secret with secrets.TOKEN_NAME.",
				},
			],
		},
		{
			id: "output",
			label: "Output",
			condition: IS_REST_CONNECTOR,
			fields: [
				{
					key: "resultVariable",
					label: "Result variable",
					type: "text",
					placeholder: "response",
					hint: "Stores the full response object in this process variable.",
				},
				{
					key: "resultExpression",
					label: "Result expression",
					type: "textarea",
					placeholder: "= { orderId: response.body.id }",
					hint: "FEEL expression to extract values from the response.",
				},
				{
					key: "retryBackoff",
					label: "Retry backoff",
					type: "text",
					placeholder: "PT0S",
					hint: "ISO 8601 duration (e.g. PT5S for 5 seconds). Default: PT0S.",
				},
			],
		},
	],
};

const SERVICE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};

		const ext = parseZeebeExtensions(el.extensionElements);

		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			taskType: ext.taskDefinition?.type ?? "",
			retries: ext.taskDefinition?.retries ?? "",
			method: getIoInput(ext, "method") ?? "GET",
			url: getIoInput(ext, "url") ?? "",
			headers: getIoInput(ext, "headers") ?? "",
			queryParameters: getIoInput(ext, "queryParameters") ?? "",
			body: getIoInput(ext, "body") ?? "",
			connectionTimeoutInSeconds: getIoInput(ext, "connectionTimeoutInSeconds") ?? "",
			readTimeoutInSeconds: getIoInput(ext, "readTimeoutInSeconds") ?? "",
			authType: getIoInput(ext, "authentication.type") ?? "noAuth",
			authToken: getIoInput(ext, "authentication.token") ?? "",
			resultVariable: getTaskHeader(ext, "resultVariable") ?? "",
			resultExpression: getTaskHeader(ext, "resultExpression") ?? "",
			retryBackoff: getTaskHeader(ext, "retryBackoff") ?? "",
		};
	},

	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const name = typeof values.name === "string" ? values.name : el.name;
			const documentation =
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation;

			// Preserve non-zeebe extension elements (custom extensions roundtrip)
			const ZEEBE_EXTS = ["taskDefinition", "ioMapping", "taskHeaders"];
			const otherExts = el.extensionElements.filter(
				(x) => !ZEEBE_EXTS.includes(xmlLocalName(x.name)),
			);

			const taskType = strVal(values.taskType);
			const retries = strVal(values.retries);
			const authType = strVal(values.authType) || "noAuth";

			// Build ioMapping inputs
			const inputs: Array<{ source: string; target: string }> = [];
			inputs.push({ source: authType, target: "authentication.type" });
			const authToken = strVal(values.authToken);
			if (authType === "bearer" && authToken) {
				inputs.push({ source: authToken, target: "authentication.token" });
			}
			const method = strVal(values.method) || "GET";
			inputs.push({ source: method, target: "method" });
			const url = strVal(values.url);
			if (url) inputs.push({ source: url, target: "url" });
			const headers = strVal(values.headers);
			if (headers) inputs.push({ source: headers, target: "headers" });
			const qp = strVal(values.queryParameters);
			if (qp) inputs.push({ source: qp, target: "queryParameters" });
			const body = strVal(values.body);
			if (body) inputs.push({ source: body, target: "body" });
			const connTimeout = strVal(values.connectionTimeoutInSeconds);
			if (connTimeout) inputs.push({ source: connTimeout, target: "connectionTimeoutInSeconds" });
			const readTimeout = strVal(values.readTimeoutInSeconds);
			if (readTimeout) inputs.push({ source: readTimeout, target: "readTimeoutInSeconds" });

			// Build taskHeaders
			const taskHeadersList: Array<{ key: string; value: string }> = [];
			const resultVar = strVal(values.resultVariable);
			if (resultVar) taskHeadersList.push({ key: "resultVariable", value: resultVar });
			const resultExpr = strVal(values.resultExpression);
			if (resultExpr) taskHeadersList.push({ key: "resultExpression", value: resultExpr });
			const retryBackoff = strVal(values.retryBackoff);
			if (retryBackoff) taskHeadersList.push({ key: "retryBackoff", value: retryBackoff });

			const newZeebeExts = zeebeExtensionsToXmlElements({
				taskDefinition: taskType ? { type: taskType, retries: retries || undefined } : undefined,
				ioMapping: inputs.length > 0 ? { inputs, outputs: [] } : undefined,
				taskHeaders: taskHeadersList.length > 0 ? { headers: taskHeadersList } : undefined,
			});

			return {
				...el,
				name,
				documentation,
				extensionElements: [...otherExts, ...newZeebeExts],
			};
		});
	},
};

function strVal(v: FieldValue): string {
	return typeof v === "string" ? v : "";
}

// ── All element types that get the general schema ─────────────────────────────

const GENERAL_TYPES: CreateShapeType[] = [
	"startEvent",
	"endEvent",
	"userTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
];

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the BPMN config panel extension plugin.
 *
 * Registers property schemas for all standard BPMN element types. Service tasks
 * get a comprehensive form including Zeebe task definition and REST connector
 * fields.
 *
 * @param configPanel - The base config panel plugin returned by
 *   `createConfigPanelPlugin`. Schemas are registered into it.
 */
export function createConfigPanelBpmnPlugin(configPanel: ConfigPanelPlugin): CanvasPlugin {
	return {
		name: "config-panel-bpmn",

		install() {
			// Register general schema for common element types
			for (const type of GENERAL_TYPES) {
				configPanel.registerSchema(type, GENERAL_SCHEMA, GENERAL_ADAPTER);
			}

			// Service task gets the full connector form
			configPanel.registerSchema("serviceTask", SERVICE_TASK_SCHEMA, SERVICE_TASK_ADAPTER);
		},
	};
}

// Re-export label map for external use
export { ELEMENT_TYPE_LABELS };
