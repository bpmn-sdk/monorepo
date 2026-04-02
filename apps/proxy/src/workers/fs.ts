import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import type { WorkerJob } from "../worker.js"
import { interpolate } from "../worker.js"

export const JOB_TYPE_READ = "io.bpmnkit:fs:read:1"
export const JOB_TYPE_WRITE = "io.bpmnkit:fs:write:1"
export const JOB_TYPE_APPEND = "io.bpmnkit:fs:append:1"
export const JOB_TYPE_LIST = "io.bpmnkit:fs:list:1"

function resolvePath(raw: string, vars: Record<string, unknown>): string {
	const p = interpolate(raw, vars)
	const resolved = p.startsWith("~/") || p === "~" ? homedir() + p.slice(1) : resolve(p)
	const root = process.env.BPMNKIT_FS_ROOT
	if (root) {
		const rootResolved = resolve(root)
		if (!resolved.startsWith(`${rootResolved}/`) && resolved !== rootResolved) {
			throw new Error(
				`Path "${resolved}" is outside the allowed root "${rootResolved}". Set BPMNKIT_FS_ROOT to change this.`,
			)
		}
	}
	return resolved
}

/**
 * io.bpmnkit:fs:read:1
 * Variables: path (string)
 * Outputs:   content (string)
 */
export async function handleRead(job: WorkerJob): Promise<Record<string, unknown>> {
	const raw = (job.variables.path as string | undefined) ?? job.customHeaders.path
	if (!raw) throw new Error('fs:read requires variable or header "path"')
	const path = resolvePath(raw, job.variables)
	console.log(`[worker:fs:read] ${path}`)
	const content = readFileSync(path, "utf8")
	const rv = job.customHeaders.resultVariable
	if (rv) return { [rv]: content }
	return { content }
}

/**
 * io.bpmnkit:fs:write:1
 * Variables: path (string), content (string)
 * Outputs:   bytesWritten (number)
 */
export async function handleWrite(job: WorkerJob): Promise<Record<string, unknown>> {
	const rawPath = (job.variables.path as string | undefined) ?? job.customHeaders.path
	if (!rawPath) throw new Error('fs:write requires variable or header "path"')
	const path = resolvePath(rawPath, job.variables)
	const content = String(job.variables.content ?? "")
	console.log(`[worker:fs:write] ${path} (${content.length} chars)`)
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(path, content, "utf8")
	return { bytesWritten: Buffer.byteLength(content, "utf8") }
}

/**
 * io.bpmnkit:fs:append:1
 * Variables: path (string), content (string)
 * Outputs:   bytesWritten (number)
 */
export async function handleAppend(job: WorkerJob): Promise<Record<string, unknown>> {
	const rawPath = (job.variables.path as string | undefined) ?? job.customHeaders.path
	if (!rawPath) throw new Error('fs:append requires variable or header "path"')
	const path = resolvePath(rawPath, job.variables)
	const content = String(job.variables.content ?? "")
	console.log(`[worker:fs:append] ${path}`)
	mkdirSync(dirname(path), { recursive: true })
	appendFileSync(path, content, "utf8")
	return { bytesWritten: Buffer.byteLength(content, "utf8") }
}

/**
 * io.bpmnkit:fs:list:1
 * Variables: path (string)
 * Outputs:   files (string[])
 */
export async function handleList(job: WorkerJob): Promise<Record<string, unknown>> {
	const raw = (job.variables.path as string | undefined) ?? job.customHeaders.path
	if (!raw) throw new Error('fs:list requires variable or header "path"')
	const path = resolvePath(raw, job.variables)
	console.log(`[worker:fs:list] ${path}`)
	const entries = readdirSync(path, { withFileTypes: true })
	const files = entries
		.filter((e) => !e.name.startsWith("."))
		.map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
	const rv = job.customHeaders.resultVariable
	if (rv) return { [rv]: files }
	return { files }
}
