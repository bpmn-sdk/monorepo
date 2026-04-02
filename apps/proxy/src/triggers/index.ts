/**
 * Trigger orchestrator — starts all trigger types on proxy startup.
 *
 * Respects `BPMNKIT_TRIGGERS=false` to opt out of all triggers.
 */
import { startFileWatchTrigger } from "./file-watcher.js"
import { startTimerTrigger } from "./timer.js"

export { matchWebhookRoute, handleWebhook } from "./webhook.js"

export function startTriggers(): void {
	if (process.env.BPMNKIT_TRIGGERS === "false") {
		console.log("[triggers] disabled via BPMNKIT_TRIGGERS=false")
		return
	}

	startTimerTrigger()
	startFileWatchTrigger()
	console.log("[triggers] timer and file-watch triggers started")
}
