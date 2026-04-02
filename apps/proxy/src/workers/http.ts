import type { WorkerJob } from "../worker.js"
import { interpolate } from "../worker.js"

export const JOB_TYPE = "io.bpmnkit:http:scrape:1"

/**
 * HTTP scraper worker — fetches a URL and extracts text content.
 *
 * Task headers:
 *   url            (required) — URL to fetch, supports {{varName}} interpolation
 *   timeout        (optional) — timeout in seconds; default 30
 *   resultVariable (optional) — if set, wraps result under this key; default outputs at root
 */
export async function handle(job: WorkerJob): Promise<Record<string, unknown>> {
	const urlTemplate = job.customHeaders.url
	if (!urlTemplate) {
		throw new Error('HTTP worker requires a "url" task header')
	}

	const url = interpolate(urlTemplate, job.variables)
	const timeoutSec = Number(job.customHeaders.timeout ?? "30")
	const resultVariable = job.customHeaders.resultVariable ?? ""

	console.log(`[worker:http] GET ${url}`)

	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutSec * 1000)

	let html: string
	let statusCode: number
	try {
		const res = await fetch(url, { signal: controller.signal })
		statusCode = res.status
		html = await res.text()
		if (!res.ok) {
			throw new Error(`HTTP ${statusCode} from ${url}`)
		}
	} finally {
		clearTimeout(timer)
	}

	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
	const title = titleMatch?.[1]?.trim() ?? ""

	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()

	const result: Record<string, unknown> = { url, html, text, title, statusCode }

	if (resultVariable) return { [resultVariable]: result }
	return result
}
