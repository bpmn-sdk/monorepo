import { exec } from "node:child_process"
import { homedir } from "node:os"
import { promisify } from "node:util"
import type { WorkerJob } from "../worker.js"
import { interpolate } from "../worker.js"

const execAsync = promisify(exec)

export const JOB_TYPE = "io.bpmnkit:cli:1"

/**
 * CLI worker — runs a shell command and returns stdout/stderr/exitCode.
 *
 * Task headers:
 *   command       (required) — shell command, supports {{varName}} and {{secrets.NAME}} interpolation
 *   cwd           (optional) — working directory; default ~
 *   timeout       (optional) — timeout in seconds; default 60
 *   ignoreExitCode (optional) — "true" to complete even on non-zero exit; default false
 *   resultVariable (optional) — if set, wraps result under this key; default outputs at root
 */
export async function handle(job: WorkerJob): Promise<Record<string, unknown>> {
	const commandTemplate = job.customHeaders.command
	if (!commandTemplate) {
		throw new Error('CLI worker requires a "command" task header')
	}

	const cwd = job.customHeaders.cwd
		? expandHome(interpolate(job.customHeaders.cwd, job.variables))
		: homedir()
	const timeoutSec = Number(job.customHeaders.timeout ?? "60")
	const ignoreExitCode = job.customHeaders.ignoreExitCode === "true"

	const command = interpolate(commandTemplate, job.variables)

	console.log(`[worker:cli] running: ${command}`)

	let stdout = ""
	let stderr = ""
	let exitCode = 0

	try {
		const result = await execAsync(command, {
			cwd,
			timeout: timeoutSec * 1000,
			shell: "/bin/sh",
		})
		stdout = result.stdout
		stderr = result.stderr
	} catch (err) {
		const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
		stdout = e.stdout ?? ""
		stderr = e.stderr ?? e.message ?? String(err)
		exitCode = e.code ?? 1

		if (!ignoreExitCode) {
			throw new Error(`Command exited with code ${exitCode}: ${stderr.trim() || stdout.trim()}`)
		}
	}

	const result: Record<string, unknown> = { stdout, stderr, exitCode }

	const rv = job.customHeaders.resultVariable
	if (rv) return { [rv]: result }
	return result
}

function expandHome(p: string): string {
	if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1)
	return p
}
