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
import { CAMUNDA_CONNECTOR_TEMPLATES } from "./templates/generated.js";
export { CAMUNDA_CONNECTOR_TEMPLATES } from "./templates/generated.js";
export { templateToServiceTaskOptions } from "./template-to-service-task.js";
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

/** Templates applicable to service tasks. */
const SERVICE_TASK_TEMPLATES = CAMUNDA_CONNECTOR_TEMPLATES.filter(
	(t) => t.appliesTo.includes("bpmn:ServiceTask") || t.appliesTo.includes("bpmn:Task"),
);

/** Extract the fixed task definition type from a template's Hidden binding. */
function extractTaskType(t: ElementTemplate): string | undefined {
	for (const p of t.properties) {
		if (typeof p.value !== "string") continue;
		if (
			(p.binding.type === "zeebe:taskDefinition" &&
				"property" in p.binding &&
				p.binding.property === "type") ||
			p.binding.type === "zeebe:taskDefinition:type"
		) {
			return p.value;
		}
	}
	return undefined;
}

// Register all Camunda connector templates
for (const tpl of CAMUNDA_CONNECTOR_TEMPLATES) {
	TEMPLATE_REGISTRY.set(tpl.id, buildRegistrationFromTemplate(tpl));
}

/**
 * Task definition type → template id mapping (first-wins; used for
 * backward-compat detection in `read` when `zeebe:modelerTemplate` is absent).
 */
const TASK_TYPE_TO_TEMPLATE_ID = new Map<string, string>();
for (const tpl of SERVICE_TASK_TEMPLATES) {
	const taskType = extractTaskType(tpl);
	if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
		TASK_TYPE_TO_TEMPLATE_ID.set(taskType, tpl.id);
	}
}

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

/**
 * Connector selector options keyed by template id (not task type) so each of
 * the 116+ connectors gets its own entry, even when multiple share a task type.
 */
const CONNECTOR_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	...SERVICE_TASK_TEMPLATES.flatMap((t) =>
		extractTaskType(t) ? [{ value: t.id, label: t.name }] : [],
	),
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
		const connectorVal = strVal(values.connector);
		const isCustom = connectorVal === CUSTOM_TASK_TYPE;
		// connector is either a template id (new) or a task type (backward-compat read)
		const newTemplateId = isCustom
			? undefined
			: TEMPLATE_REGISTRY.has(connectorVal)
				? connectorVal
				: TASK_TYPE_TO_TEMPLATE_ID.get(connectorVal);

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
			const taskType = extractTaskType(template);
			if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
				TASK_TYPE_TO_TEMPLATE_ID.set(taskType, template.id);
			}
			if (!CONNECTOR_OPTIONS.some((o) => o.value === template.id)) {
				CONNECTOR_OPTIONS.push({ value: template.id, label: template.name });
			}
		},
	};
}

// Re-export types for external use
export { ELEMENT_TYPE_LABELS };
export type { ElementTemplate };
