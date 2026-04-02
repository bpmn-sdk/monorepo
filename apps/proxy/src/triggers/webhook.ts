/**
 * Webhook trigger — starts a process instance when `POST /webhooks/:processId`
 * is called. The request body becomes the process variables.
 *
 * Optional security: set a `WEBHOOK_TOKEN` env var; the trigger then requires
 * `Authorization: Bearer <token>` on incoming requests.
 */
import type { IncomingMessage, ServerResponse } from "node:http"
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"

// ── Request matcher ───────────────────────────────────────────────────────────

/** Returns the processId if the request matches `POST /webhooks/:processId`. */
export function matchWebhookRoute(req: IncomingMessage): { processId: string } | null {
	if (req.method !== "POST") return null
	const m = /^\/webhooks\/([^/?]+)/.exec(req.url ?? "")
	if (!m || !m[1]) return null
	return { processId: m[1] }
}

// ── Handler ───────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on("data", (chunk: Buffer) => chunks.push(chunk))
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
		req.on("error", reject)
	})
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body)
	res.writeHead(status, { "content-type": "application/json" })
	res.end(payload)
}

export async function handleWebhook(
	req: IncomingMessage,
	res: ServerResponse,
	processId: string,
): Promise<void> {
	// Token guard (optional)
	const token = process.env.WEBHOOK_TOKEN
	if (token) {
		const auth = req.headers.authorization ?? ""
		if (auth !== `Bearer ${token}`) {
			sendJson(res, 401, { error: "Unauthorized" })
			return
		}
	}

	// Parse body
	let variables: Record<string, unknown> = {}
	try {
		const raw = await readBody(req)
		if (raw.trim()) {
			variables = JSON.parse(raw) as Record<string, unknown>
		}
	} catch {
		sendJson(res, 400, { error: "Invalid JSON body" })
		return
	}

	// Start process instance via reebe
	const profile = getActiveProfile()
	if (!profile?.config.baseUrl) {
		sendJson(res, 503, { error: "No active reebe profile" })
		return
	}

	const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
	let authHeader = ""
	try {
		authHeader = await getAuthHeader(profile.config)
	} catch {
		// proceed without auth
	}

	const startRes = await fetch(`${baseUrl}/v2/process-instances`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({ processDefinitionId: processId, variables }),
	})

	if (!startRes.ok) {
		const text = await startRes.text()
		sendJson(res, startRes.status, { error: text })
		return
	}

	const data = (await startRes.json()) as { processInstanceKey?: string }
	console.log(`[trigger:webhook] started ${processId} → instance ${data.processInstanceKey ?? "?"}`)
	sendJson(res, 200, { processInstanceKey: data.processInstanceKey })
}
