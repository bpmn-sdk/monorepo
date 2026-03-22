import { readFile, writeFile } from "node:fs/promises"
import { Bpmn, renderStoryHtml } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const storyCmd: Command = {
	name: "story",
	description: "Render a BPMN process as a standalone story-mode HTML file",
	args: [{ name: "file", description: "Path to the .bpmn file", required: true }],
	flags: [
		{
			name: "output",
			short: "o",
			description: "Output path (default: <file>.story.html)",
			type: "string",
		},
		{
			name: "theme",
			description: "Color theme: light (default) or dark",
			type: "string",
		},
	],
	async run(ctx) {
		const filePath = ctx.positional[0]
		if (!filePath) throw new Error("Missing required argument: <file>")

		const xml = await readFile(filePath, "utf-8")
		const defs = Bpmn.parse(xml)

		const themeFlag = ctx.flags.theme
		const theme: "dark" | "light" = themeFlag === "dark" ? "dark" : "light"

		const outputFlag = ctx.flags.output
		const outputPath =
			typeof outputFlag === "string" && outputFlag.length > 0
				? outputFlag
				: `${filePath}.story.html`

		const html = renderStoryHtml(defs, { standalone: true, theme })
		await writeFile(outputPath, html, "utf-8")

		ctx.output.ok(`Story HTML written to ${outputPath}`)
	},
}

export const storyGroup: CommandGroup = {
	name: "story",
	description: "Render BPMN processes as narrative HTML",
	commands: [storyCmd],
}
