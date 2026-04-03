import { startServer } from "@bpmnkit/proxy"
import type { Command, CommandGroup } from "../types.js"

const startCmd: Command = {
	name: "start",
	description: "Start the BPMN Kit proxy server (AI bridge + Camunda API proxy)",
	flags: [
		{
			name: "port",
			description: "Port to listen on",
			type: "number",
			default: 3033,
		},
	],
	examples: [
		{ description: "Start on default port (3033)", command: "casen proxy start" },
		{ description: "Start on a custom port", command: "casen proxy start --port 4000" },
	],
	async run(ctx) {
		const port = (ctx.flags.port as number | undefined) ?? 3033

		ctx.output.info(`Starting BPMN Kit proxy server on port ${port}...`)

		startServer(port)

		// Keep the CLI alive until the user presses Ctrl+C
		await new Promise<void>((resolve) => {
			process.once("SIGINT", resolve)
			process.once("SIGTERM", resolve)
		})
	},
}

export const proxyGroup: CommandGroup = {
	name: "proxy",
	description: "Start the local AI bridge and Camunda API proxy server",
	commands: [startCmd],
}
