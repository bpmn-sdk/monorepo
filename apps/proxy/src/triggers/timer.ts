/**
 * Timer trigger — scans deployed processes for BPMN timer start events and
 * fires `POST /v2/process-instances` at the appropriate times.
 *
 * Supports:
 *   timeDuration  ISO 8601 duration  (PT1H → repeat every 1 hour)
 *   timeDate      ISO 8601 datetime  (2026-01-01T00:00:00Z → fire once)
 *   timeCycle     ISO 8601 repeating (R/PT30M or R3/PT1H → repeat N or ∞ times)
 *
 * Last-fired timestamps are persisted to `~/.bpmnkit/timer-state.json` to
 * survive proxy restarts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimerDef {
	processId: string
	type: "duration" | "date" | "cycle"
	/** ISO 8601 value as a string */
	value: string
	/** How many remaining fires (undefined = infinite) */
	remaining?: number
}

interface TimerState {
	lastFired: Record<string, number> // processId → timestamp ms
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STATE_PATH = join(homedir(), ".bpmnkit", "timer-state.json")

function loadState(): TimerState {
	try {
		if (existsSync(STATE_PATH)) {
			return JSON.parse(readFileSync(STATE_PATH, "utf8")) as TimerState
		}
	} catch {
		// corrupt file — start fresh
	}
	return { lastFired: {} }
}

function saveState(state: TimerState): void {
	try {
		writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8")
	} catch {
		// best-effort
	}
}

// ── ISO 8601 duration parser ──────────────────────────────────────────────────

const DURATION_RE =
	/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

function parseDurationMs(iso: string): number | null {
	const m = DURATION_RE.exec(iso)
	if (!m) return null
	const years = Number(m[1] ?? 0)
	const months = Number(m[2] ?? 0)
	const days = Number(m[3] ?? 0)
	const hours = Number(m[4] ?? 0)
	const minutes = Number(m[5] ?? 0)
	const seconds = Number(m[6] ?? 0)
	// Approximate: 1 year = 365 days, 1 month = 30 days
	return (
		(years * 365 * 24 * 60 * 60 +
			months * 30 * 24 * 60 * 60 +
			days * 24 * 60 * 60 +
			hours * 60 * 60 +
			minutes * 60 +
			seconds) *
		1000
	)
}

/**
 * Parse an ISO 8601 repeating interval: `R<n>/<duration>` or `R/<duration>`.
 * Returns { durationMs, remaining } where remaining=undefined means infinite.
 */
function parseCycle(value: string): { durationMs: number; remaining?: number } | null {
	const m = /^R(\d*)\/(.+)$/.exec(value)
	if (!m) return null
	const durationMs = parseDurationMs(m[2] ?? "")
	if (!durationMs) return null
	const n = m[1] ? Number(m[1]) : undefined
	return { durationMs, remaining: n }
}

// ── BPMN scanning ─────────────────────────────────────────────────────────────

interface DeployedProcess {
	processDefinitionId: string
	bpmnXml?: string
}

async function fetchDeployedProcesses(
	baseUrl: string,
	authHeader: string,
): Promise<DeployedProcess[]> {
	const res = await fetch(`${baseUrl}/v2/process-definitions/search`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({ pageSize: 100 }),
	})
	if (!res.ok) return []
	const data = (await res.json()) as { items?: { processDefinitionId: string }[] }
	return data.items ?? []
}

async function fetchProcessXml(
	baseUrl: string,
	authHeader: string,
	processId: string,
): Promise<string | null> {
	const res = await fetch(
		`${baseUrl}/v2/process-definitions/${encodeURIComponent(processId)}/xml`,
		{
			headers: { authorization: authHeader },
		},
	)
	if (!res.ok) return null
	const data = (await res.json()) as { bpmnXml?: string }
	return data.bpmnXml ?? null
}

/** Extract timer start event definitions from BPMN XML (simple regex approach). */
function extractTimerDefs(processId: string, xml: string): TimerDef[] {
	const defs: TimerDef[] = []

	// Match <timerEventDefinition> children: timeDuration, timeDate, timeCycle
	const timerRe =
		/<timerEventDefinition[^>]*>[\s\S]*?<(timeDuration|timeDate|timeCycle)[^>]*>\s*([^<]+)\s*<\/\1>/g
	let m: RegExpExecArray | null
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
	while ((m = timerRe.exec(xml)) !== null) {
		const kind = m[1] as "timeDuration" | "timeDate" | "timeCycle"
		const raw = m[2]?.trim() ?? ""

		// Strip FEEL expression wrapper if present (e.g. = "PT1H" or = PT1H)
		const value = raw
			.replace(/^=\s*["']?/, "")
			.replace(/["']$/, "")
			.trim()
		if (!value) continue

		if (kind === "timeDuration") {
			defs.push({ processId, type: "duration", value })
		} else if (kind === "timeDate") {
			defs.push({ processId, type: "date", value })
		} else {
			const cycle = parseCycle(value)
			if (cycle) {
				defs.push({ processId, type: "cycle", value, remaining: cycle.remaining })
			}
		}
	}

	return defs
}

// ── Firing ────────────────────────────────────────────────────────────────────

async function fireProcess(baseUrl: string, authHeader: string, processId: string): Promise<void> {
	const res = await fetch(`${baseUrl}/v2/process-instances`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({ processDefinitionId: processId, variables: {} }),
	})
	if (res.ok) {
		const data = (await res.json()) as { processInstanceKey?: string }
		console.log(`[trigger:timer] fired ${processId} → instance ${data.processInstanceKey ?? "?"}`)
	} else {
		console.error(`[trigger:timer] failed to start ${processId}: ${res.status}`)
	}
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let timerDefs: TimerDef[] = []
const timerState = loadState()

async function scanAndSchedule(): Promise<void> {
	const profile = getActiveProfile()
	if (!profile?.config.baseUrl) return
	const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
	if (!baseUrl.startsWith("http")) return

	let authHeader = ""
	try {
		authHeader = await getAuthHeader(profile.config)
	} catch {
		// proceed unauthenticated
	}

	let processes: DeployedProcess[]
	try {
		processes = await fetchDeployedProcesses(baseUrl, authHeader)
	} catch {
		return
	}

	const defs: TimerDef[] = []
	for (const proc of processes) {
		const xml = await fetchProcessXml(baseUrl, authHeader, proc.processDefinitionId)
		if (xml) {
			defs.push(...extractTimerDefs(proc.processDefinitionId, xml))
		}
	}
	timerDefs = defs
	if (defs.length > 0) {
		console.log(`[trigger:timer] tracking ${defs.length} timer(s)`)
	}
}

async function tickTimers(): Promise<void> {
	const profile = getActiveProfile()
	if (!profile?.config.baseUrl) return
	const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
	if (!baseUrl.startsWith("http")) return

	let authHeader = ""
	try {
		authHeader = await getAuthHeader(profile.config)
	} catch {
		// proceed unauthenticated
	}

	const now = Date.now()

	for (const def of timerDefs) {
		const lastFired = timerState.lastFired[def.processId] ?? 0

		if (def.type === "date") {
			const target = new Date(def.value).getTime()
			if (Number.isNaN(target)) continue
			if (now >= target && lastFired < target) {
				await fireProcess(baseUrl, authHeader, def.processId)
				timerState.lastFired[def.processId] = now
				saveState(timerState)
			}
			continue
		}

		if (def.type === "duration" || def.type === "cycle") {
			const durationMs =
				def.type === "duration"
					? parseDurationMs(def.value)
					: (parseCycle(def.value)?.durationMs ?? null)

			if (!durationMs || durationMs <= 0) continue

			// Skip if this process has exhausted its repeat count
			if (def.remaining !== undefined && def.remaining <= 0) continue

			const due = lastFired + durationMs
			if (now >= due) {
				await fireProcess(baseUrl, authHeader, def.processId)
				timerState.lastFired[def.processId] = now
				if (def.remaining !== undefined) def.remaining--
				saveState(timerState)
			}
		}
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 60_000
const TICK_INTERVAL_MS = 5_000

export function startTimerTrigger(): void {
	// Initial scan
	void scanAndSchedule()

	// Re-scan every 60 s for newly deployed processes
	setInterval(() => {
		void scanAndSchedule()
	}, SCAN_INTERVAL_MS)

	// Tick every 5 s to check for due timers
	setInterval(() => {
		void tickTimers()
	}, TICK_INTERVAL_MS)
}
