import type { BpmnDefinitions, BpmnFlowElement, XmlElement } from "@bpmn-sdk/core";
import type { ZeebeExtensions, ZeebeIoMappingEntry, ZeebeTaskHeaderEntry } from "@bpmn-sdk/core";

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Strip namespace prefix: "zeebe:taskDefinition" → "taskDefinition" */
export function xmlLocalName(qname: string): string {
	const idx = qname.indexOf(":");
	return idx >= 0 ? qname.slice(idx + 1) : qname;
}

// ── Element lookup / update ───────────────────────────────────────────────────

export function findFlowElement(defs: BpmnDefinitions, id: string): BpmnFlowElement | undefined {
	for (const process of defs.processes) {
		const el = process.flowElements.find((e) => e.id === id);
		if (el) return el;
	}
	return undefined;
}

export function updateFlowElement(
	defs: BpmnDefinitions,
	id: string,
	fn: (el: BpmnFlowElement) => BpmnFlowElement,
): BpmnDefinitions {
	const processIdx = defs.processes.findIndex((p) => p.flowElements.some((e) => e.id === id));
	if (processIdx < 0) return defs;
	const process = defs.processes[processIdx];
	if (!process) return defs;
	const elIdx = process.flowElements.findIndex((e) => e.id === id);
	if (elIdx < 0) return defs;
	const el = process.flowElements[elIdx];
	if (!el) return defs;
	const newEl = fn(el);
	const newElements = process.flowElements.map((e, i) => (i === elIdx ? newEl : e));
	const newProcess = { ...process, flowElements: newElements };
	return {
		...defs,
		processes: defs.processes.map((p, i) => (i === processIdx ? newProcess : p)),
	};
}

// ── Zeebe extension parsing ───────────────────────────────────────────────────

export function parseZeebeExtensions(extensionElements: XmlElement[]): ZeebeExtensions {
	const ext: ZeebeExtensions = {};

	for (const el of extensionElements) {
		const ln = xmlLocalName(el.name);

		if (ln === "taskDefinition") {
			ext.taskDefinition = {
				type: el.attributes.type ?? "",
				retries: el.attributes.retries,
			};
		} else if (ln === "ioMapping") {
			const inputs: ZeebeIoMappingEntry[] = [];
			const outputs: ZeebeIoMappingEntry[] = [];
			for (const child of el.children) {
				const cln = xmlLocalName(child.name);
				if (cln === "input") {
					inputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					});
				} else if (cln === "output") {
					outputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					});
				}
			}
			ext.ioMapping = { inputs, outputs };
		} else if (ln === "taskHeaders") {
			const headers: ZeebeTaskHeaderEntry[] = [];
			for (const child of el.children) {
				if (xmlLocalName(child.name) === "header") {
					headers.push({
						key: child.attributes.key ?? "",
						value: child.attributes.value ?? "",
					});
				}
			}
			ext.taskHeaders = { headers };
		}
	}

	return ext;
}

/** Get the value of a zeebe:ioMapping input by target name. */
export function getIoInput(ext: ZeebeExtensions, target: string): string | undefined {
	return ext.ioMapping?.inputs.find((i) => i.target === target)?.source;
}

/** Get the value of a zeebe:taskHeader by key. */
export function getTaskHeader(ext: ZeebeExtensions, key: string): string | undefined {
	return ext.taskHeaders?.headers.find((h) => h.key === key)?.value;
}
