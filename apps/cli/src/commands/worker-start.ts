import { spawn } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { Command } from "../types.js"

/**
 * Start scaffolded workers from the ./workers/ directory.
 * Workers must have a package.json with a `bpmnkit.jobType` field (written by worker_scaffold).
 * Runs `npm start` in each worker directory — workers use tsx for development convenience.
 */
export const workerStartCmd: Command = {
	name: "start",
	description: "Start scaffolded workers from the ./workers/ directory",
	args: [
		{
			name: "name",
			description: "Worker name to start (default: start all workers)",
			required: false,
		},
	],
	flags: [],
	examples: [
		{ description: "Start all scaffolded workers", command: "casen worker start" },
		{ description: "Start a specific worker", command: "casen worker start send-invoice" },
	],

	async run(ctx) {
		const filterName = ctx.positional[0]
		const workersDir = join(process.cwd(), "workers")

		if (!existsSync(workersDir)) {
			ctx.output.info(
				"No workers/ directory found. Use the /implement skill or worker_scaffold MCP tool to create workers.",
			)
			return
		}

		// Discover scaffolded workers (those with bpmnkit.jobType in their package.json)
		const entries = readdirSync(workersDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.filter((e) => {
				const pkgPath = join(workersDir, e.name, "package.json")
				if (!existsSync(pkgPath)) return false
				try {
					const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
						bpmnkit?: { jobType?: string }
					}
					return Boolean(pkg.bpmnkit?.jobType)
				} catch {
					return false
				}
			})

		if (entries.length === 0) {
			ctx.output.info("No scaffolded workers found in workers/")
			return
		}

		const toStart = filterName ? entries.filter((e) => e.name === filterName) : entries

		if (filterName && toStart.length === 0) {
			throw new Error(`Worker "${filterName}" not found in workers/`)
		}

		ctx.output.info(`Starting ${toStart.length} worker(s) — press Ctrl+C to stop`)
		ctx.output.info("")

		for (const entry of toStart) {
			const workerDir = join(workersDir, entry.name)

			// Read job type for display
			let jobType = entry.name
			try {
				const pkg = JSON.parse(readFileSync(join(workerDir, "package.json"), "utf8")) as {
					bpmnkit?: { jobType?: string }
				}
				jobType = pkg.bpmnkit?.jobType ?? entry.name
			} catch {
				/* ignore */
			}

			ctx.output.info(`  [${entry.name}] starting — job type: ${jobType}`)

			const child = spawn("npm", ["start"], {
				cwd: workerDir,
				stdio: "inherit",
				shell: true,
			})

			child.on("error", (err) => {
				process.stderr.write(
					`[${entry.name}] failed to start: ${err.message}\n` +
						`  Did you run \`npm install\` in workers/${entry.name}/?\n`,
				)
			})
		}
	},
}
