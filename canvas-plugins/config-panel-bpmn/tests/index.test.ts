import type { BpmnDefinitions, XmlElement } from "@bpmn-sdk/core";
import { describe, expect, it, vi } from "vitest";
import { createConfigPanelBpmnPlugin } from "../src/index.js";

const REST_TYPE = "io.camunda:http-json:1";

// Minimal zeebe:taskDefinition XmlElement helper
function taskDefExt(type: string, retries?: string): XmlElement {
	return {
		name: "zeebe:taskDefinition",
		attributes: retries ? { type, retries } : { type },
		children: [],
	};
}

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

	// ── Connector selector tests ───────────────────────────────────────────────

	it("service task adapter reads connector as REST when taskDefinition type is REST", () => {
		const adapters = new Map<
			string,
			{ adapter: { read: (d: BpmnDefinitions, id: string) => Record<string, unknown> } }
		>();
		const mock = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn(
				(
					t: string,
					_s: unknown,
					a: { read: (d: BpmnDefinitions, id: string) => Record<string, unknown> },
				) => {
					adapters.set(t, { adapter: a });
				},
			),
		};
		createConfigPanelBpmnPlugin(mock).install({
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
		const reg = adapters.get("serviceTask");
		if (!reg) throw new Error("serviceTask not registered");

		const defs = makeMinimalDefs({ extensionElements: [taskDefExt(REST_TYPE)] });
		const values = reg.adapter.read(defs, "task1");

		expect(values.connector).toBe(REST_TYPE);
		expect(values.taskType).toBe(""); // hidden when REST connector is active
	});

	it("service task adapter reads connector as empty string for custom task type", () => {
		const adapters = new Map<
			string,
			{ adapter: { read: (d: BpmnDefinitions, id: string) => Record<string, unknown> } }
		>();
		const mock = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn(
				(
					t: string,
					_s: unknown,
					a: { read: (d: BpmnDefinitions, id: string) => Record<string, unknown> },
				) => {
					adapters.set(t, { adapter: a });
				},
			),
		};
		createConfigPanelBpmnPlugin(mock).install({
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
		const reg = adapters.get("serviceTask");
		if (!reg) throw new Error("serviceTask not registered");

		const defs = makeMinimalDefs({ extensionElements: [taskDefExt("my-custom-worker")] });
		const values = reg.adapter.read(defs, "task1");

		expect(values.connector).toBe("");
		expect(values.taskType).toBe("my-custom-worker");
	});

	it("service task adapter write with REST connector sets task type to REST and builds ioMapping", () => {
		type WriteAdapter = {
			read: (d: BpmnDefinitions, id: string) => Record<string, unknown>;
			write: (d: BpmnDefinitions, id: string, v: Record<string, unknown>) => BpmnDefinitions;
		};
		const adapters = new Map<string, { adapter: WriteAdapter }>();
		const mock = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn((t: string, _s: unknown, a: WriteAdapter) => {
				adapters.set(t, { adapter: a });
			}),
		};
		createConfigPanelBpmnPlugin(mock).install({
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
		const reg = adapters.get("serviceTask");
		if (!reg) throw new Error("serviceTask not registered");

		const defs = makeMinimalDefs();
		const newDefs = reg.adapter.write(defs, "task1", {
			connector: REST_TYPE,
			url: "https://api.example.com",
			method: "POST",
		});

		const el = newDefs.processes[0]?.flowElements[0];
		if (!el) throw new Error("element not found");
		const taskDef = el.extensionElements.find((x) => x.name === "zeebe:taskDefinition");
		expect(taskDef?.attributes.type).toBe(REST_TYPE);

		const ioMapping = el.extensionElements.find((x) => x.name === "zeebe:ioMapping");
		const urlInput = ioMapping?.children.find(
			(c) => c.name === "zeebe:input" && c.attributes.target === "url",
		);
		expect(urlInput?.attributes.source).toBe("https://api.example.com");
	});

	it("service task adapter write with custom connector uses taskType field and clears ioMapping", () => {
		type WriteAdapter = {
			read: (d: BpmnDefinitions, id: string) => Record<string, unknown>;
			write: (d: BpmnDefinitions, id: string, v: Record<string, unknown>) => BpmnDefinitions;
		};
		const adapters = new Map<string, { adapter: WriteAdapter }>();
		const mock = {
			name: "config-panel",
			install: vi.fn(),
			uninstall: vi.fn(),
			registerSchema: vi.fn((t: string, _s: unknown, a: WriteAdapter) => {
				adapters.set(t, { adapter: a });
			}),
		};
		createConfigPanelBpmnPlugin(mock).install({
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
		const reg = adapters.get("serviceTask");
		if (!reg) throw new Error("serviceTask not registered");

		const defs = makeMinimalDefs();
		const newDefs = reg.adapter.write(defs, "task1", { connector: "", taskType: "my-worker" });

		const el = newDefs.processes[0]?.flowElements[0];
		if (!el) throw new Error("element not found");
		const taskDef = el.extensionElements.find((x) => x.name === "zeebe:taskDefinition");
		expect(taskDef?.attributes.type).toBe("my-worker");
		// No REST ioMapping should be written for custom connector
		const ioMapping = el.extensionElements.find((x) => x.name === "zeebe:ioMapping");
		expect(ioMapping).toBeUndefined();
	});
});
