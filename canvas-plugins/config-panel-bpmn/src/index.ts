/**
 * @bpmn-sdk/canvas-plugin-config-panel-bpmn — BPMN element schemas for the
 * config panel plugin.
 *
 * Registers config panel schemas for all standard BPMN element types. For
 * service tasks the panel is template-aware: when `zeebe:modelerTemplate` is
 * set on an element the matching template's property form is shown instead of
 * the generic connector selector.
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
import { buildRegistrationFromTemplate } from "./template-engine.js";
import type { ElementTemplate } from "./template-types.js";
import { REST_CONNECTOR_TEMPLATE } from "./templates/rest-connector.js";
import {
	findFlowElement,
	getIoInput,
	getTaskHeader,
	parseZeebeExtensions,
	updateFlowElement,
	xmlLocalName,
} from "./util.js";

// ── Built-in template registry ────────────────────────────────────────────────

/**
 * All built-in Camunda connector templates, keyed by template id.
 * Pre-built so that reference-equality comparisons in the renderer work.
 */
const TEMPLATE_REGISTRY = new Map<string, ReturnType<typeof buildRegistrationFromTemplate>>();

function registerBuiltInTemplate(t: ElementTemplate): void {
	TEMPLATE_REGISTRY.set(t.id, buildRegistrationFromTemplate(t));
}

registerBuiltInTemplate(REST_CONNECTOR_TEMPLATE);

/** Task definition type → template id mapping (for connector selector). */
const TASK_TYPE_TO_TEMPLATE_ID: Map<string, string> = new Map([
	["io.camunda:http-json:1", REST_CONNECTOR_TEMPLATE.id],
]);

/** Template id → task definition type (reverse lookup). */
const TEMPLATE_ID_TO_TASK_TYPE: Map<string, string> = new Map(
	[...TASK_TYPE_TO_TEMPLATE_ID.entries()].map(([k, v]) => [v, k]),
);

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

// ── Service task schema (generic — shown when no template is applied) ─────────

const CUSTOM_TASK_TYPE = "";

const IS_CUSTOM = (values: Record<string, FieldValue>) => values.connector === CUSTOM_TASK_TYPE;

/** Connector selector options: custom + one entry per registered template. */
const CONNECTOR_OPTIONS = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	{ value: "io.camunda:http-json:1", label: "REST Outbound Connector" },
];

const GENERIC_SERVICE_TASK_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
				{
					key: "connector",
					label: "Connector",
					type: "select",
					options: CONNECTOR_OPTIONS,
					hint: "Select a Camunda connector or use a custom job worker type.",
				},
				{
					key: "taskType",
					label: "Task type",
					type: "text",
					placeholder: "e.g. my-worker-type",
					hint: "Zeebe job type string consumed by your worker.",
					condition: IS_CUSTOM,
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
	],
};

const SERVICE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const ext = parseZeebeExtensions(el.extensionElements);
		const definitionType = ext.taskDefinition?.type ?? "";
		// Detect template via explicit attribute OR by known task type (backward-compat)
		const hasTemplate =
			Boolean(el.unknownAttributes?.["zeebe:modelerTemplate"]) ||
			TASK_TYPE_TO_TEMPLATE_ID.has(definitionType);
		// Connector selector value = the task definition type when template is active
		const connector = hasTemplate ? definitionType : CUSTOM_TASK_TYPE;

		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			connector,
			taskType: connector === CUSTOM_TASK_TYPE ? definitionType : "",
			retries: ext.taskDefinition?.retries ?? "",
		};
	},

	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const isCustom = strVal(values.connector) === CUSTOM_TASK_TYPE;
		const newTemplateId = isCustom
			? undefined
			: TASK_TYPE_TO_TEMPLATE_ID.get(strVal(values.connector));

		if (newTemplateId) {
			// Switching to (or already on) a template: stamp the attribute then delegate
			// all field writing to the template adapter so it handles template-specific fields.
			const withAttr = updateFlowElement(defs, id, (el) => ({
				...el,
				name: typeof values.name === "string" ? values.name || undefined : el.name,
				unknownAttributes: {
					...el.unknownAttributes,
					"zeebe:modelerTemplate": newTemplateId,
				},
			}));
			const templateReg = TEMPLATE_REGISTRY.get(newTemplateId);
			if (templateReg) return templateReg.adapter.write(withAttr, id, values);
			return withAttr;
		}

		// Custom task or clearing a template
		return updateFlowElement(defs, id, (el) => {
			const name = typeof values.name === "string" ? values.name : el.name;
			const documentation =
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation;
			const taskType = strVal(values.taskType);
			const retries = strVal(values.retries);

			const ZEEBE_EXTS = new Set(["taskDefinition", "ioMapping", "taskHeaders"]);
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_EXTS.has(xmlLocalName(x.name)));

			const newZeebeExts = zeebeExtensionsToXmlElements({
				taskDefinition: taskType ? { type: taskType, retries: retries || undefined } : undefined,
			});

			// Remove modelerTemplate attribute when switching to custom
			const {
				"zeebe:modelerTemplate": _t,
				"zeebe:modelerTemplateVersion": _v,
				...rest
			} = el.unknownAttributes;

			return {
				...el,
				name,
				documentation,
				extensionElements: [...otherExts, ...newZeebeExts],
				unknownAttributes: rest,
			};
		});
	},

	/**
	 * When `zeebe:modelerTemplate` is set on the element, switch to the
	 * matching template registration instead of the generic form.
	 */
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return null;
		const templateId = el.unknownAttributes?.["zeebe:modelerTemplate"];
		if (!templateId) return null;
		return TEMPLATE_REGISTRY.get(templateId) ?? null;
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function strVal(v: FieldValue): string {
	return typeof v === "string" ? v : "";
}

/** Return the raw ElementTemplate object for a given id (for Hidden prop defaults). */
function getTemplateById(id: string): ElementTemplate | undefined {
	if (id === REST_CONNECTOR_TEMPLATE.id) return REST_CONNECTOR_TEMPLATE;
	return undefined;
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
 * are template-aware: when `zeebe:modelerTemplate` is set the matching
 * connector template form is rendered; otherwise a generic connector selector
 * is shown. Custom templates can be registered via `registerTemplate`.
 *
 * @param configPanel - The base config panel plugin returned by
 *   `createConfigPanelPlugin`.
 */
export function createConfigPanelBpmnPlugin(configPanel: ConfigPanelPlugin): CanvasPlugin & {
	/** Register an additional element template to make it available in the UI. */
	registerTemplate(template: ElementTemplate): void;
} {
	return {
		name: "config-panel-bpmn",

		install() {
			// Register general schema for common element types
			for (const type of GENERAL_TYPES) {
				configPanel.registerSchema(type, GENERAL_SCHEMA, GENERAL_ADAPTER);
			}
			// Service task: template-aware adapter
			configPanel.registerSchema("serviceTask", GENERIC_SERVICE_TASK_SCHEMA, SERVICE_TASK_ADAPTER);
		},

		registerTemplate(template: ElementTemplate): void {
			TEMPLATE_REGISTRY.set(template.id, buildRegistrationFromTemplate(template));
			const taskType = TEMPLATE_ID_TO_TASK_TYPE.get(template.id);
			if (!taskType) return; // custom template without a known task type
			// Ensure the connector selector shows the new template
			if (!CONNECTOR_OPTIONS.some((o) => o.value === taskType)) {
				CONNECTOR_OPTIONS.push({ value: taskType, label: template.name });
			}
		},
	};
}

// Re-export types for external use
export { ELEMENT_TYPE_LABELS };
export type { ElementTemplate };
