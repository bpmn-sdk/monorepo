import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { exportSvg } from "../src/bpmn/svg.js"

// Build a reusable process with a variety of element types
function buildProcess() {
	return Bpmn.createProcess("test")
		.startEvent("start", { name: "Start" })
		.serviceTask("svc", { name: "Service Task", taskType: "my-worker" })
		.userTask("usr", { name: "Review", formId: "f1" })
		.exclusiveGateway("gw", { name: "OK?" })
		.branch("yes", (b) => b.condition("= approved").endEvent("end-ok", { name: "Done" }))
		.branch("no", (b) => b.defaultFlow().endEvent("end-no", { name: "Rejected" }))
		.withAutoLayout()
		.build()
}

describe("exportSvg", () => {
	it("returns a valid SVG string", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toMatch(/^<svg /)
		expect(svg).toMatch(/<\/svg>$/)
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
	})

	it("contains a viewBox", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toMatch(/viewBox="[\d. -]+"/)
	})

	it("includes element labels", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toContain("Service Task")
		expect(svg).toContain("Review")
		expect(svg).toContain("OK?")
		expect(svg).toContain("Start")
	})

	it("uses light theme colors by default", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		// Light theme background
		expect(svg).toContain("#f8f9fa")
		expect(svg).toContain("#ffffff")
	})

	it("uses dark theme colors when requested", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs, { theme: "dark" })
		expect(svg).toContain("#1e1e2e")
		expect(svg).toContain("#2a2a3e")
	})

	it("respects custom padding", () => {
		const defs = buildProcess()
		const svg0 = exportSvg(defs, { padding: 0 })
		const svg50 = exportSvg(defs, { padding: 50 })
		// Larger padding → larger width/height values in the SVG
		const w0 = Number(svg0.match(/width="([\d.]+)"/)?.[1] ?? 0)
		const w50 = Number(svg50.match(/width="([\d.]+)"/)?.[1] ?? 0)
		expect(w50).toBeGreaterThan(w0)
	})

	it("includes an arrow marker in defs", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toContain("<defs>")
		expect(svg).toContain('<marker id="arr"')
	})

	it("emits edge paths", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		// Should have sequence flow paths with marker-end
		expect(svg).toContain('marker-end="url(#arr)"')
	})

	it("handles a process with no DI gracefully", () => {
		// Build without autoLayout — no diagrams array populated
		const defs = Bpmn.createProcess("empty").startEvent("s").endEvent("e").build()
		// Remove diagram data
		defs.diagrams = []
		const svg = exportSvg(defs)
		expect(svg).toMatch(/^<svg /)
	})

	it("produces the same output for repeated calls (deterministic)", () => {
		const defs = buildProcess()
		expect(exportSvg(defs)).toBe(exportSvg(defs))
	})

	it("renders all gateway types without throwing", () => {
		const types = ["exclusiveGateway", "parallelGateway", "inclusiveGateway"] as const
		for (const gwType of types) {
			const defs = Bpmn.createProcess("gw-test")
				.startEvent("s")
				[gwType]("gw")
				.branch("a", (b) => b.endEvent("e1"))
				.branch("b", (b) => b.endEvent("e2"))
				.withAutoLayout()
				.build()
			expect(() => exportSvg(defs)).not.toThrow()
		}
	})

	it("renders task types with icons without throwing", () => {
		const defs = Bpmn.createProcess("icons")
			.startEvent("s")
			.userTask("u", { name: "User" })
			.serviceTask("svc", { name: "Service", taskType: "t" })
			.scriptTask("sc", { name: "Script" })
			.businessRuleTask("br", { name: "Rule", decisionId: "d" })
			.endEvent("e")
			.withAutoLayout()
			.build()
		expect(() => exportSvg(defs)).not.toThrow()
		const svg = exportSvg(defs)
		expect(svg).toContain("User")
		expect(svg).toContain("Service")
	})
})
