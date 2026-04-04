import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Command, CommandGroup } from "../types.js"

/**
 * Install BPMNKit AIKit skills into `.claude/commands/` in the current project.
 * Skills are markdown prompt files that Claude Code executes as slash commands:
 *   /implement, /review, /test, /deploy
 */
const skillsInstallCmd: Command = {
	name: "install",
	description: "Install BPMNKit AIKit slash commands into .claude/commands/",
	args: [],
	flags: [
		{
			name: "force",
			short: "f",
			description: "Overwrite existing skill files",
			type: "boolean",
		},
	],
	examples: [
		{ description: "Install AIKit skills", command: "casen skills install" },
		{
			description: "Reinstall and overwrite existing skills",
			command: "casen skills install --force",
		},
	],

	async run(ctx) {
		const force = ctx.flags.force === true

		// Locate the bundled skills directory relative to this binary
		// Installed layout: dist/index.js → ../skills/<name>.md
		const binDir = fileURLToPath(new URL(".", import.meta.url))
		const skillsSrc = join(binDir, "..", "skills")

		if (!existsSync(skillsSrc)) {
			throw new Error(`Bundled skills directory not found at: ${skillsSrc}`)
		}

		const skillFiles = readdirSync(skillsSrc).filter((f) => f.endsWith(".md"))
		if (skillFiles.length === 0) {
			throw new Error("No skill files found in bundled skills directory")
		}

		const destDir = join(process.cwd(), ".claude", "commands")
		mkdirSync(destDir, { recursive: true })

		let installed = 0
		let skipped = 0

		for (const file of skillFiles) {
			const dest = join(destDir, file)
			if (existsSync(dest) && !force) {
				ctx.output.info(`  skip  ${file} (already exists — use --force to overwrite)`)
				skipped++
				continue
			}
			const content = readFileSync(join(skillsSrc, file), "utf8")
			writeFileSync(dest, content, "utf8")
			ctx.output.ok(`  wrote ${file}`)
			installed++
		}

		ctx.output.info("")
		ctx.output.ok(
			`Installed ${installed} skill(s)${skipped > 0 ? `, skipped ${skipped}` : ""} → .claude/commands/`,
		)
		ctx.output.info("")
		ctx.output.info("Available slash commands in Claude Code:")
		for (const file of skillFiles) {
			const name = file.replace(/\.md$/, "")
			ctx.output.info(`  /${name}`)
		}
		ctx.output.info("")
		ctx.output.info("Make sure the BPMNKit AIKit MCP server is configured in .claude/mcp.json")
	},
}

export const skillsGroup: CommandGroup = {
	name: "skills",
	description: "Manage BPMNKit AIKit slash commands for Claude Code",
	commands: [skillsInstallCmd],
}
