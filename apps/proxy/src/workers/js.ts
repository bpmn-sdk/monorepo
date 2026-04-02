import { runInNewContext } from "node:vm"
import type { WorkerJob } from "../worker.js"

export const JOB_TYPE = "io.bpmnkit:js:1"

/**
 * JavaScript eval worker — evaluates an expression with process variables in scope.
 *
 * Task headers:
 *   expression     (required) — JS expression; receives `variables` object in scope
 *   resultVariable (optional) — variable name to store result; default "result"
 *
 * Example expression:  variables.items.filter(x => x.score > 0.5).length
 */
export async function handle(job: WorkerJob): Promise<Record<string, unknown>> {
	const expression = job.customHeaders.expression
	if (!expression) {
		throw new Error('js worker requires an "expression" task header')
	}

	const resultVariable = job.customHeaders.resultVariable ?? "result"

	const result: unknown = runInNewContext(`(${expression})`, { variables: job.variables })

	return { [resultVariable]: result }
}
