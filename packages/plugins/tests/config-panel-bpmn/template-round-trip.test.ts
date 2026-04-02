/**
 * Template round-trip tests — verify that writing values via the template
 * adapter and reading them back returns the same values, both in-memory and
 * after a full XML serialize → parse cycle.
 */
import type { BpmnDefinitions } from "@bpmnkit/core"
import { Bpmn } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { buildRegistrationFromTemplate } from "../../src/config-panel-bpmn/template-engine.js"
import { BUILTIN_WORKER_TEMPLATES } from "../../src/connector-catalog/builtin-templates.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeServiceTaskDefs(id = "task1", name = "My Task"): BpmnDefinitions {
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
						id,
						type: "serviceTask",
						name,
						incoming: [],
						outgoing: [],
						extensionElements: [],
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
	}
}

function getTemplate(id: string) {
	const t = BUILTIN_WORKER_TEMPLATES.find((tmpl) => tmpl.id === id)
	if (!t) throw new Error(`Template not found: ${id}`)
	return t
}

// ── In-memory adapter round-trips ─────────────────────────────────────────────

describe("CLI Command template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.cli")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back all fields", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Run build",
			command: "make build",
			cwd: "~/projects/app",
			timeout: "120",
			ignoreExitCode: "false",
			resultVariable: "buildResult",
		})
		const values = adapter.read(written, "task1")

		expect(values.name).toBe("Run build")
		expect(values.command).toBe("make build")
		expect(values.cwd).toBe("~/projects/app")
		expect(values.timeout).toBe("120")
		expect(values.resultVariable).toBe("buildResult")
	})

	it("falls back to template defaults for unset fields", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Run cmd",
			command: "echo hi",
		})
		const values = adapter.read(written, "task1")

		// resultVariable has a default of "cliResult"
		expect(values.resultVariable).toBe("cliResult")
		// timeout has a default of 60
		expect(values.timeout).toBe("60")
	})

	it("stamps zeebe:modelerTemplate attribute", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", { name: "t", command: "ls" })
		const task = written.processes[0]?.flowElements[0]
		expect(task?.unknownAttributes?.["zeebe:modelerTemplate"]).toBe("io.bpmnkit.cli")
	})

	it("removes the template stamp when __change_connector is 'remove'", () => {
		const defs = makeServiceTaskDefs()
		const withTemplate = adapter.write(defs, "task1", { name: "t", command: "ls" })
		const removed = adapter.write(withTemplate, "task1", { __change_connector: "remove" })
		const task = removed.processes[0]?.flowElements[0]
		expect(task?.unknownAttributes?.["zeebe:modelerTemplate"]).toBeUndefined()
	})
})

describe("LLM Prompt template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.llm")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back prompt and model fields", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Ask AI",
			prompt: "Summarize {{text}}",
			system: "You are a helpful assistant.",
			model: "claude",
			resultVariable: "summary",
		})
		const values = adapter.read(written, "task1")

		expect(values.name).toBe("Ask AI")
		expect(values.prompt).toBe("Summarize {{text}}")
		expect(values.system).toBe("You are a helpful assistant.")
		expect(values.model).toBe("claude")
		expect(values.resultVariable).toBe("summary")
	})

	it("defaults result variable to 'response'", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", { name: "t", prompt: "Hello" })
		const values = adapter.read(written, "task1")
		expect(values.resultVariable).toBe("response")
	})
})

describe("Read File template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.fs.read")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back path and result variable", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Read config",
			path: "~/config.json",
			resultVariable: "config",
		})
		const values = adapter.read(written, "task1")

		expect(values.path).toBe("~/config.json")
		expect(values.resultVariable).toBe("config")
	})
})

describe("Write File template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.fs.write")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back path and content", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Save report",
			path: "~/output/report.md",
			content: "= reportText",
		})
		const values = adapter.read(written, "task1")

		expect(values.path).toBe("~/output/report.md")
		expect(values.content).toBe("= reportText")
	})
})

describe("JavaScript Expression template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.js")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back expression and result variable", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Filter items",
			expression: "variables.items.filter(x => x.score > 0.5)",
			resultVariable: "highScoreItems",
		})
		const values = adapter.read(written, "task1")

		expect(values.expression).toBe("variables.items.filter(x => x.score > 0.5)")
		expect(values.resultVariable).toBe("highScoreItems")
	})
})

describe("File Watch Trigger template — adapter round-trip", () => {
	const template = getTemplate("io.bpmnkit.trigger.file-watch")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("writes and reads back watchPath, events, and glob", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Watch reports",
			watchPath: "~/Documents/reports",
			events: "add",
			glob: "*.csv",
		})
		const values = adapter.read(written, "task1")

		expect(values.watchPath).toBe("~/Documents/reports")
		expect(values.events).toBe("add")
		expect(values.glob).toBe("*.csv")
	})
})

// ── XML serialize → parse round-trips ─────────────────────────────────────────

describe("XML round-trip — CLI Command", () => {
	const template = getTemplate("io.bpmnkit.cli")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("preserves all field values after Bpmn.export → Bpmn.parse", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Deploy",
			command: "npm run deploy -- --env {{env}}",
			cwd: "~/app",
			timeout: "300",
			ignoreExitCode: "false",
			resultVariable: "deployResult",
		})

		// Serialize to XML then parse back
		const xml = Bpmn.export(written)
		expect(xml).toContain("zeebe:taskDefinition")
		expect(xml).toContain("io.bpmnkit:cli:1")

		const reparsed = Bpmn.parse(xml)
		const values = adapter.read(reparsed, "task1")

		expect(values.name).toBe("Deploy")
		expect(values.command).toBe("npm run deploy -- --env {{env}}")
		expect(values.cwd).toBe("~/app")
		expect(values.timeout).toBe("300")
		expect(values.resultVariable).toBe("deployResult")
	})

	it("preserves modelerTemplate attribute through XML round-trip", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", { name: "t", command: "ls" })

		const xml = Bpmn.export(written)
		expect(xml).toContain(`zeebe:modelerTemplate="io.bpmnkit.cli"`)

		const reparsed = Bpmn.parse(xml)
		const task = reparsed.processes[0]?.flowElements[0]
		expect(task?.unknownAttributes?.["zeebe:modelerTemplate"]).toBe("io.bpmnkit.cli")
	})
})

describe("XML round-trip — LLM Prompt", () => {
	const template = getTemplate("io.bpmnkit.llm")
	const { adapter } = buildRegistrationFromTemplate(template)

	it("preserves prompt and model through XML round-trip", () => {
		const defs = makeServiceTaskDefs()
		const written = adapter.write(defs, "task1", {
			name: "Summarize",
			prompt: "Summarize the following: {{content}}",
			model: "gemini",
			resultVariable: "summary",
		})

		const xml = Bpmn.export(written)
		const reparsed = Bpmn.parse(xml)
		const values = adapter.read(reparsed, "task1")

		expect(values.prompt).toBe("Summarize the following: {{content}}")
		expect(values.model).toBe("gemini")
		expect(values.resultVariable).toBe("summary")
	})
})

describe("XML round-trip — all built-in templates have correct task types", () => {
	const expectedTaskTypes: Record<string, string> = {
		"io.bpmnkit.cli": "io.bpmnkit:cli:1",
		"io.bpmnkit.llm": "io.bpmnkit:llm:1",
		"io.bpmnkit.fs.read": "io.bpmnkit:fs:read:1",
		"io.bpmnkit.fs.write": "io.bpmnkit:fs:write:1",
		"io.bpmnkit.fs.append": "io.bpmnkit:fs:append:1",
		"io.bpmnkit.fs.list": "io.bpmnkit:fs:list:1",
		"io.bpmnkit.js": "io.bpmnkit:js:1",
		"io.bpmnkit.trigger.file-watch": "io.bpmnkit:trigger:file-watch:1",
	}

	for (const [templateId, expectedType] of Object.entries(expectedTaskTypes)) {
		it(`${templateId} writes correct zeebe:taskDefinition type`, () => {
			const template = getTemplate(templateId)
			const { adapter } = buildRegistrationFromTemplate(template)
			const defs = makeServiceTaskDefs()
			const written = adapter.write(defs, "task1", { name: "t" })

			const xml = Bpmn.export(written)
			expect(xml).toContain(`type="${expectedType}"`)
		})
	}
})
