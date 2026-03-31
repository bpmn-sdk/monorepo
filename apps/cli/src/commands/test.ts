import { readFile, readdir } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import { runScenarioWasm } from "@bpmnkit/engine/wasm-runner"
import type { ScenarioLike } from "@bpmnkit/engine/wasm-runner"
import type { Command, CommandGroup } from "../types.js"

const testCmd: Command = {
	name: "test",
	description: "Run scenario tests for a BPMN process file",
	args: [
		{
			name: "file",
			description: "Path to the .bpmn file",
			required: true,
		},
	],
	flags: [
		{
			name: "scenarios",
			short: "s",
			description: "Path to the .bpmn.tests.json scenarios file (default: <file>.tests.json)",
			type: "string",
		},
	],
	async run(ctx) {
		const bpmnPath = ctx.positional[0]
		if (bpmnPath === undefined) throw new Error("Missing required argument: <file>")

		const scenariosPath =
			typeof ctx.flags.scenarios === "string" ? ctx.flags.scenarios : `${bpmnPath}.tests.json`

		const bpmnXml = await readFile(bpmnPath, "utf8").catch(() => {
			throw new Error(`Cannot read BPMN file: ${bpmnPath}`)
		})

		const scenariosRaw = await readFile(scenariosPath, "utf8").catch(() => {
			throw new Error(`Cannot read scenarios file: ${scenariosPath}`)
		})

		let scenarios: ScenarioLike[]
		try {
			scenarios = JSON.parse(scenariosRaw) as ScenarioLike[]
		} catch {
			throw new Error(`Invalid JSON in scenarios file: ${scenariosPath}`)
		}

		if (!Array.isArray(scenarios) || scenarios.length === 0) {
			ctx.output.info("No scenarios found.")
			return
		}

		// Build a decision-ID → DMN XML map from all *.dmn files in the BPMN's directory.
		const bpmnDir = dirname(bpmnPath)
		const dirFiles = await readdir(bpmnDir).catch(() => [] as string[])
		const decisionMap = new Map<string, string>()
		for (const file of dirFiles) {
			if (extname(file).toLowerCase() !== ".dmn") continue
			const dmnXml = await readFile(join(bpmnDir, file), "utf8").catch(() => null)
			if (dmnXml === null) continue
			for (const [, id] of dmnXml.matchAll(/<decision[^>]+\bid="([^"]+)"/g)) {
				if (id) decisionMap.set(id, dmnXml)
			}
		}

		const getDecisionDmn =
			decisionMap.size > 0 ? (id: string) => decisionMap.get(id) ?? null : undefined

		let passed = 0
		let failed = 0

		for (const scenario of scenarios) {
			const result = await runScenarioWasm(bpmnXml, scenario, getDecisionDmn)
			if (result.passed) {
				passed++
				ctx.output.ok(`PASS  ${scenario.name}  (${result.durationMs}ms)`)
			} else {
				failed++
				ctx.output.info(`FAIL  ${scenario.name}  (${result.durationMs}ms)`)
				for (const f of result.failures) {
					ctx.output.info(
						`       ${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`,
					)
				}
				for (const e of result.errors) {
					ctx.output.info(
						`       error${e.elementId !== undefined ? ` (${e.elementId})` : ""}: ${e.message}`,
					)
				}
			}
		}

		const total = passed + failed
		ctx.output.info(`\n${passed}/${total} passed`)
		if (failed > 0) {
			throw new Error(`${failed} scenario(s) failed`)
		}
	},
}

export const testGroup: CommandGroup = {
	name: "test",
	description: "Run scenario-based tests for BPMN processes",
	commands: [testCmd],
}
