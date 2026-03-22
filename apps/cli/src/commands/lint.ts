import { readFile } from "node:fs/promises"
import { Bpmn, optimize } from "@bpmnkit/core"
import type { OptimizationCategory } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const SEVERITY_SYMBOL: Record<string, string> = {
	error: "✖",
	warning: "⚠",
	info: "ℹ",
}

const lintCmd: Command = {
	name: "lint",
	description: "Lint a BPMN file — run all static analysis and pattern checks",
	args: [{ name: "file", description: "Path to the .bpmn file", required: true }],
	flags: [
		{
			name: "categories",
			description: "Comma-separated categories to run (default: all)",
			type: "string",
		},
		{
			name: "format",
			description: "Output format: text (default) or json",
			type: "string",
		},
	],
	async run(ctx) {
		const filePath = ctx.positional[0]
		if (!filePath) throw new Error("Missing required argument: <file>")

		const xml = await readFile(filePath, "utf-8")
		const defs = Bpmn.parse(xml)

		const categoriesFlag = ctx.flags.categories
		const categories =
			typeof categoriesFlag === "string" && categoriesFlag.length > 0
				? (categoriesFlag.split(",").map((s) => s.trim()) as OptimizationCategory[])
				: undefined

		const report = optimize(defs, categories !== undefined ? { categories } : undefined)
		const { findings } = report

		const formatFlag = ctx.flags.format
		if (formatFlag === "json") {
			ctx.output.print(findings)
			return
		}

		if (findings.length === 0) {
			ctx.output.ok("No issues found.")
			return
		}

		for (const f of findings) {
			const symbol = SEVERITY_SYMBOL[f.severity] ?? "·"
			const elIds = f.elementIds.length > 0 ? ` [${f.elementIds.join(", ")}]` : ""
			ctx.output.info(`${symbol} [${f.category}]${elIds} ${f.message}`)
		}

		const { total, bySeverity } = report.summary
		const errorCount = bySeverity.error ?? 0
		const warnCount = bySeverity.warning ?? 0
		const infoCount = bySeverity.info ?? 0
		ctx.output.info(
			`\n${total} finding${total !== 1 ? "s" : ""}: ${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warnCount} warning${warnCount !== 1 ? "s" : ""}, ${infoCount} info`,
		)

		if (errorCount > 0) {
			throw new Error(`Lint failed with ${errorCount} error${errorCount !== 1 ? "s" : ""}`)
		}
	},
}

export const lintGroup: CommandGroup = {
	name: "lint",
	description: "Lint BPMN files using the static analyzer",
	commands: [lintCmd],
}
