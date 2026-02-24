import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { describe, expect, it, vi } from "vitest";
import { createConfigPanelBpmnPlugin } from "../src/index.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMinimalDefs(
	overrides: Partial<{
		id: string;
		name: string;
		extensionElements: import("@bpmn-sdk/core").XmlElement[];
	}> = {},
): BpmnDefinitions {
	return {
		id: "defs1",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [
			{
				id: "proc1",
				extensionElements: [],
				flowElements: [
					{
						id: overrides.id ?? "task1",
						type: "serviceTask",
						name: overrides.name ?? "My Task",
						incoming: [],
						outgoing: [],
						extensionElements: overrides.extensionElements ?? [],
						unknownAttributes: {},
					},
				],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
				unknownAttributes: {},
			},
		],
		diagrams: [],
	};
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("createConfigPanelBpmnPlugin", () => {
	it("returns a plugin with the correct name", () => {
		const mockConfigPanel = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn(),
		};
		const plugin = createConfigPanelBpmnPlugin(mockConfigPanel);
		expect(plugin.name).toBe("config-panel-bpmn");
	});

	it("registers schemas for known element types on install", () => {
		const registeredTypes: string[] = [];
		const mockConfigPanel = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn((type: string) => {
				registeredTypes.push(type);
			}),
		};
		const plugin = createConfigPanelBpmnPlugin(mockConfigPanel);
		const api = {
			container: document.createElement("div"),
			svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
			viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
			getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
			setViewport: vi.fn(),
			getShapes: () => [],
			getEdges: () => [],
			getTheme: () => "dark" as const,
			setTheme: vi.fn(),
			on: (_e: unknown, _h: unknown) => () => {},
			emit: vi.fn(),
		};
		plugin.install(api);

		expect(registeredTypes).toContain("serviceTask");
		expect(registeredTypes).toContain("startEvent");
		expect(registeredTypes).toContain("endEvent");
		expect(registeredTypes).toContain("exclusiveGateway");
	});

	it("service task adapter reads name and documentation", () => {
		const registeredAdapters = new Map<
			string,
			{
				adapter: {
					read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>;
				};
			}
		>();
		const mockConfigPanel = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn(
				(
					type: string,
					_schema: unknown,
					adapter: { read: (defs: BpmnDefinitions, id: string) => Record<string, unknown> },
				) => {
					registeredAdapters.set(type, { adapter });
				},
			),
		};
		const plugin = createConfigPanelBpmnPlugin(mockConfigPanel);
		plugin.install({
			container: document.createElement("div"),
			svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
			viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
			getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
			setViewport: vi.fn(),
			getShapes: () => [],
			getEdges: () => [],
			getTheme: () => "dark" as const,
			setTheme: vi.fn(),
			on: (_e: unknown, _h: unknown) => () => {},
			emit: vi.fn(),
		});

		const serviceTaskReg = registeredAdapters.get("serviceTask");
		if (!serviceTaskReg) throw new Error("serviceTask adapter not registered");

		const defs = makeMinimalDefs({ id: "task1", name: "Process Order" });
		const values = serviceTaskReg.adapter.read(defs, "task1");

		expect(values.name).toBe("Process Order");
	});

	it("general adapter writes name back to definitions", () => {
		const registeredAdapters = new Map<
			string,
			{
				adapter: {
					read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>;
					write: (
						defs: BpmnDefinitions,
						id: string,
						values: Record<string, unknown>,
					) => BpmnDefinitions;
				};
			}
		>();
		const mockConfigPanel = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn(
				(
					type: string,
					_schema: unknown,
					adapter: {
						read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>;
						write: (
							defs: BpmnDefinitions,
							id: string,
							values: Record<string, unknown>,
						) => BpmnDefinitions;
					},
				) => {
					registeredAdapters.set(type, { adapter });
				},
			),
		};
		const plugin = createConfigPanelBpmnPlugin(mockConfigPanel);
		plugin.install({
			container: document.createElement("div"),
			svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
			viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
			getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
			setViewport: vi.fn(),
			getShapes: () => [],
			getEdges: () => [],
			getTheme: () => "dark" as const,
			setTheme: vi.fn(),
			on: (_e: unknown, _h: unknown) => () => {},
			emit: vi.fn(),
		});

		const startEventReg = registeredAdapters.get("startEvent");
		if (!startEventReg) throw new Error("startEvent adapter not registered");

		// Add a startEvent to the defs
		const defs: BpmnDefinitions = {
			...makeMinimalDefs(),
			processes: [
				{
					id: "proc1",
					extensionElements: [],
					flowElements: [
						{
							id: "start1",
							type: "startEvent",
							name: "Old Name",
							incoming: [],
							outgoing: [],
							extensionElements: [],
							unknownAttributes: {},
							eventDefinitions: [],
						},
					],
					sequenceFlows: [],
					textAnnotations: [],
					associations: [],
					unknownAttributes: {},
				},
			],
		};

		const newDefs = startEventReg.adapter.write(defs, "start1", { name: "New Name" });
		const updated = newDefs.processes[0]?.flowElements[0];
		expect(updated?.name).toBe("New Name");
	});
});
