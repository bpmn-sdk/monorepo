import { mkdirSync } from "node:fs"
import type http from "node:http"
import { homedir } from "node:os"
import { join } from "node:path"
/**
 * Run history store — persists worker job execution history to SQLite.
 *
 * Schema:
 *   runs  — one row per process instance (groups all steps for an instance)
 *   steps — one row per job execution (CLI, LLM, FS, JS, etc.)
 *
 * Routes:
 *   GET /run-history           — paginated list of runs (most recent first)
 *   GET /run-history/:id       — single run with all steps
 *   DELETE /run-history        — clear all history
 */
import Database from "better-sqlite3"
import type { WorkerJob } from "../worker.js"

// ── DB init ───────────────────────────────────────────────────────────────────

const DB_DIR = join(homedir(), ".bpmnkit")
const DB_PATH = join(DB_DIR, "run-history.db")

let db: Database.Database | null = null

function getDb(): Database.Database {
	if (db) return db
	mkdirSync(DB_DIR, { recursive: true })
	db = new Database(DB_PATH)
	db.pragma("journal_mode = WAL")
	db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id                 TEXT PRIMARY KEY,
      processInstanceKey TEXT NOT NULL,
      processId          TEXT,
      startedAt          TEXT NOT NULL,
      endedAt            TEXT,
      state              TEXT NOT NULL DEFAULT 'active',
      variablesSnapshot  TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS steps (
      id           TEXT PRIMARY KEY,
      runId        TEXT NOT NULL REFERENCES runs(id),
      elementId    TEXT NOT NULL,
      jobType      TEXT NOT NULL,
      startedAt    TEXT NOT NULL,
      endedAt      TEXT,
      durationMs   INTEGER,
      state        TEXT NOT NULL DEFAULT 'active',
      inputs       TEXT NOT NULL DEFAULT '{}',
      outputs      TEXT NOT NULL DEFAULT '{}',
      errorMessage TEXT
    );
    CREATE INDEX IF NOT EXISTS steps_runId ON steps(runId);
    CREATE INDEX IF NOT EXISTS runs_startedAt ON runs(startedAt DESC);
  `)
	return db
}

// ── Interpolation (minimal copy to avoid circular imports) ────────────────────

const VAR_RE = /\{\{([\w.]+)\}\}/g

function interpolate(template: string, vars: Record<string, unknown>): string {
	return template.replace(VAR_RE, (_match, key: string) => {
		if (key.startsWith("secrets.")) return "***"
		const val = vars[key]
		return val !== undefined ? String(val) : `{{${key}}}`
	})
}

// ── Step input extraction ─────────────────────────────────────────────────────

function extractInputs(job: WorkerJob): string {
	try {
		switch (job.type) {
			case "io.bpmnkit:llm:1": {
				const rawPrompt =
					(job.variables.prompt as string | undefined) ?? job.customHeaders.prompt ?? ""
				return JSON.stringify({
					prompt: interpolate(rawPrompt, job.variables),
					system: job.customHeaders.system
						? interpolate(job.customHeaders.system, job.variables)
						: undefined,
					model: job.customHeaders.model ?? "auto",
				})
			}
			case "io.bpmnkit:cli:1": {
				const cmd = interpolate(job.customHeaders.command ?? "", job.variables)
				return JSON.stringify({
					command: cmd,
					cwd: job.customHeaders.cwd ? interpolate(job.customHeaders.cwd, job.variables) : "~",
				})
			}
			case "io.bpmnkit:fs:read:1":
			case "io.bpmnkit:fs:write:1":
			case "io.bpmnkit:fs:append:1":
			case "io.bpmnkit:fs:list:1": {
				const path = (job.variables.path as string | undefined) ?? job.customHeaders.path ?? ""
				return JSON.stringify({ path: interpolate(path, job.variables) })
			}
			case "io.bpmnkit:js:1": {
				return JSON.stringify({ expression: job.customHeaders.expression ?? "" })
			}
			default:
				return JSON.stringify({ headers: job.customHeaders })
		}
	} catch {
		return "{}"
	}
}

// ── Public logging API (called from worker.ts) ────────────────────────────────

/** Called before a job handler is invoked. */
export function onJobStart(job: WorkerJob): void {
	try {
		const d = getDb()
		const now = new Date().toISOString()
		// Upsert the run (create on first job for this process instance)
		d.prepare(
			`INSERT INTO runs (id, processInstanceKey, processId, startedAt, state, variablesSnapshot)
       VALUES (?, ?, ?, ?, 'active', ?)
       ON CONFLICT(id) DO NOTHING`,
		).run(
			job.processInstanceKey,
			job.processInstanceKey,
			job.type.split(":")[1] ?? job.type,
			now,
			JSON.stringify(job.variables),
		)
		// Insert step
		d.prepare(
			`INSERT INTO steps (id, runId, elementId, jobType, startedAt, state, inputs)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
		).run(
			job.jobKey,
			job.processInstanceKey,
			job.elementInstanceKey,
			job.type,
			now,
			extractInputs(job),
		)
	} catch (err) {
		console.error("[run-history] onJobStart failed:", err)
	}
}

/** Called after a job handler succeeds. */
export function onJobComplete(
	job: WorkerJob,
	outputs: Record<string, unknown>,
	durationMs: number,
): void {
	try {
		const d = getDb()
		const now = new Date().toISOString()
		d.prepare(
			`UPDATE steps SET endedAt=?, durationMs=?, state='completed', outputs=? WHERE id=?`,
		).run(now, durationMs, JSON.stringify(outputs), job.jobKey)
		d.prepare(`UPDATE runs SET endedAt=?, state='completed' WHERE id=?`).run(
			now,
			job.processInstanceKey,
		)
	} catch (err) {
		console.error("[run-history] onJobComplete failed:", err)
	}
}

/** Called after a job handler throws. */
export function onJobFail(job: WorkerJob, errorMessage: string, durationMs: number): void {
	try {
		const d = getDb()
		const now = new Date().toISOString()
		d.prepare(
			`UPDATE steps SET endedAt=?, durationMs=?, state='failed', errorMessage=? WHERE id=?`,
		).run(now, durationMs, errorMessage, job.jobKey)
		d.prepare(`UPDATE runs SET endedAt=?, state='failed' WHERE id=?`).run(
			now,
			job.processInstanceKey,
		)
	} catch (err) {
		console.error("[run-history] onJobFail failed:", err)
	}
}

// ── Route handlers ────────────────────────────────────────────────────────────

interface RunRow {
	id: string
	processInstanceKey: string
	processId: string | null
	startedAt: string
	endedAt: string | null
	state: string
	variablesSnapshot: string
	stepCount?: number
	failedSteps?: number
}

interface StepRow {
	id: string
	runId: string
	elementId: string
	jobType: string
	startedAt: string
	endedAt: string | null
	durationMs: number | null
	state: string
	inputs: string
	outputs: string
	errorMessage: string | null
}

function jsonResp(res: http.ServerResponse, data: unknown, status = 200): void {
	res.writeHead(status, { "Content-Type": "application/json" })
	res.end(JSON.stringify(data))
}

/** GET /run-history — list of runs, most recent first. */
export function handleGetRunHistory(req: http.IncomingMessage, res: http.ServerResponse): void {
	try {
		const url = new URL(req.url ?? "/", "http://x")
		const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200)
		const offset = Number(url.searchParams.get("offset") ?? "0")

		const d = getDb()
		const rows = d
			.prepare(
				`SELECT r.*,
              COUNT(s.id)                        AS stepCount,
              SUM(CASE WHEN s.state='failed' THEN 1 ELSE 0 END) AS failedSteps
       FROM   runs r
       LEFT JOIN steps s ON s.runId = r.id
       GROUP BY r.id
       ORDER BY r.startedAt DESC
       LIMIT ? OFFSET ?`,
			)
			.all(limit, offset) as RunRow[]

		const total = (d.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }).n

		jsonResp(res, { items: rows, total, limit, offset })
	} catch (err) {
		jsonResp(res, { error: String(err) }, 500)
	}
}

/** GET /run-history/:id — single run with steps. */
export function handleGetRunHistoryDetail(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	runId: string,
): void {
	try {
		const d = getDb()
		const run = d.prepare("SELECT * FROM runs WHERE id=?").get(runId) as RunRow | undefined
		if (!run) {
			jsonResp(res, { error: "Not found" }, 404)
			return
		}
		const steps = d
			.prepare("SELECT * FROM steps WHERE runId=? ORDER BY startedAt ASC")
			.all(runId) as StepRow[]
		jsonResp(res, { ...run, steps })
	} catch (err) {
		jsonResp(res, { error: String(err) }, 500)
	}
}

/** DELETE /run-history — clear all history. */
export function handleDeleteRunHistory(_req: http.IncomingMessage, res: http.ServerResponse): void {
	try {
		const d = getDb()
		d.exec("DELETE FROM steps; DELETE FROM runs;")
		jsonResp(res, { deleted: true })
	} catch (err) {
		jsonResp(res, { error: String(err) }, 500)
	}
}

/** Route matcher — returns the run ID if the URL matches /run-history/:id */
export function matchRunHistoryRoute(req: http.IncomingMessage): { id: string } | null {
	const url = new URL(req.url ?? "/", "http://x")
	const m = url.pathname.match(/^\/run-history\/([^/]+)$/)
	if (m?.[1]) return { id: m[1] }
	return null
}
