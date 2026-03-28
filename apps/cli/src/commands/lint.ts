import { readFile, writeFile } from "node:fs/promises"
import { Bpmn, compactify, optimize } from "@bpmnkit/core"
import type { BpmnOperation, OptimizationCategory } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const SEVERITY_SYMBOL: Record<string, string> = {
	error: "✖",
	warning: "⚠",
	info: "ℹ",
}

const DEFAULT_SERVER = "http://localhost:3033"

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
		{
			name: "fix",
			description: "Auto-apply all fixable findings and write the result back to the file",
			type: "boolean",
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

		// --fix: apply all auto-fixable findings and write back
		if (ctx.flags.fix) {
			const fixable = findings.filter((f) => f.applyFix)
			for (const f of fixable) f.applyFix?.(defs)
			if (fixable.length === 0) {
				ctx.output.ok("No auto-fixable issues found.")
			} else {
				await writeFile(filePath, Bpmn.export(defs), "utf-8")
				ctx.output.ok(
					`Fixed ${fixable.length} issue${fixable.length === 1 ? "" : "s"} and wrote ${filePath}`,
				)
			}
			return
		}

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

function describeOp(op: BpmnOperation): string {
	switch (op.op) {
		case "rename":
			return `Rename to "${op.name}"`
		case "update":
			return "Update element properties"
		case "delete":
			return "Remove element"
		case "insert":
			return `Add ${op.element.type}${op.element.name ? ` "${op.element.name}"` : ""}`
		case "add_flow":
			return `Add flow: ${op.from} → ${op.to}`
		case "delete_flow":
			return "Remove flow"
		case "redirect_flow":
			return "Redirect flow"
	}
}

const improveCmd: Command = {
	name: "improve",
	description: "AI-assisted BPMN improvement — analyzes and suggests fixes using an AI model",
	args: [{ name: "file", description: "Path to the .bpmn file", required: true }],
	flags: [
		{
			name: "auto",
			description: "Apply the AI-suggested improvements and write the result back to the file",
			type: "boolean",
		},
		{
			name: "server",
			description: `AI proxy server URL (default: ${DEFAULT_SERVER})`,
			type: "string",
		},
	],
	async run(ctx) {
		const filePath = ctx.positional[0]
		if (!filePath) throw new Error("Missing required argument: <file>")

		const serverUrl =
			typeof ctx.flags.server === "string" && ctx.flags.server.length > 0
				? ctx.flags.server
				: DEFAULT_SERVER

		const xml = await readFile(filePath, "utf-8")
		const defs = Bpmn.parse(xml)
		const compactDiagram = compactify(defs)

		let res: Response
		try {
			res = await fetch(`${serverUrl}/improve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context: compactDiagram, instruction: null, backend: null }),
			})
		} catch (err) {
			throw new Error(
				`Cannot reach AI server at ${serverUrl}. Start it with: pnpx @bpmnkit/ai-server\n${String(err)}`,
			)
		}

		if (!res.ok || !res.body) {
			throw new Error(`AI server returned ${res.status}`)
		}

		let capturedOps: BpmnOperation[] = []
		let capturedAutoFixCount = 0
		let capturedXml: string | undefined
		let hadOutput = false

		const reader = res.body.getReader()
		const decoder = new TextDecoder()
		let buf = ""

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				buf += decoder.decode(value, { stream: true })
				const parts = buf.split("\n\n")
				buf = parts.pop() ?? ""
				for (const part of parts) {
					const line = part.startsWith("data: ") ? part.slice(6) : part
					const trimmed = line.trim()
					if (!trimmed) continue
					try {
						const event = JSON.parse(trimmed) as {
							type: string
							text?: string
							message?: string
							xml?: string
							ops?: BpmnOperation[]
							autoFixCount?: number
						}
						if (event.type === "token" && event.text) {
							process.stdout.write(event.text)
							hadOutput = true
						}
						if (event.type === "ops") {
							capturedOps = event.ops ?? []
							capturedAutoFixCount = event.autoFixCount ?? 0
						}
						if (event.type === "xml" && event.xml) capturedXml = event.xml
						if (event.type === "error") throw new Error(event.message ?? "AI error")
					} catch (e) {
						if (e instanceof SyntaxError) continue
						throw e
					}
				}
			}
		} finally {
			reader.releaseLock()
		}

		if (hadOutput) process.stdout.write("\n\n")

		// Print diff summary
		if (capturedAutoFixCount > 0) {
			ctx.output.info(
				`✓ ${capturedAutoFixCount} issue${capturedAutoFixCount === 1 ? "" : "s"} auto-fixed`,
			)
		}
		if (capturedOps.length > 0) {
			ctx.output.info("AI-suggested changes:")
			for (const op of capturedOps) {
				const prefix =
					op.op === "insert" || op.op === "add_flow"
						? "+"
						: op.op === "delete" || op.op === "delete_flow"
							? "−"
							: "~"
				ctx.output.info(`  ${prefix} ${describeOp(op)}`)
			}
		}

		if (capturedXml === undefined) {
			ctx.output.info("No changes suggested.")
			return
		}

		if (ctx.flags.auto) {
			await writeFile(filePath, capturedXml, "utf-8")
			ctx.output.ok(`Improvements applied and written to ${filePath}`)
		} else {
			ctx.output.info("\nRun with --auto to apply these changes.")
		}
	},
}

export const lintGroup: CommandGroup = {
	name: "lint",
	description: "Lint BPMN files using the static analyzer",
	commands: [lintCmd, improveCmd],
}
