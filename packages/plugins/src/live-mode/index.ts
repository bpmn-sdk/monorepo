import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectLiveModeStyles } from "./css.js"

// ── Public types ─────────────────────────────────────────────────────────────

export type LiveModeStatus =
	| "off"
	| "connecting"
	| "live"
	| "error"
	| "blocked-production"
	| "tests-failing"

export interface LiveModeOptions {
	/** Proxy server URL. Default "http://localhost:3033". */
	proxyUrl?: string
	/** Returns active profile. If isProduction=true, blocks live mode. */
	getProfile?: () => { name: string; isProduction?: boolean } | null
	/** Returns current BPMN XML string. */
	getXml: () => string | null
	/** Returns a filename for deployment. */
	getFileName?: () => string
	/** Token-highlight plugin API to drive canvas overlays. */
	tokenHighlight?: {
		api: {
			setActive(elementIds: string[]): void
			addVisited(elementIds: string[]): void
			clear(): void
		}
	}
	/** If true, require runTests() to pass green before each deploy. */
	requireTestsGreen?: boolean
	/** Called before each deploy. Return true = tests pass. */
	runTests?: () => Promise<boolean>
	/** Called when live mode status changes. */
	onStatusChange?: (status: LiveModeStatus) => void
	/** Poll interval for active element instances in ms. Default 3000. */
	pollIntervalMs?: number
}

export interface LiveModePlugin extends CanvasPlugin {
	readonly name: "live-mode"
	/** Toggle button to place in the editor toolbar. */
	readonly toggle: HTMLButtonElement
	/** Status pill element. */
	readonly status: HTMLSpanElement
	/** Disable live mode programmatically. */
	disable(): void
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

interface LiveStateRecord {
	processDefinitionKey: string
	instanceKey: string
}

const DB_NAME = "bpmnkit-live-mode-v1"
const STORE_NAME = "live-state"

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1)
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE_NAME)
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

async function loadLiveState(key: string): Promise<LiveStateRecord | null> {
	try {
		const db = await openDb()
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly")
			const req = tx.objectStore(STORE_NAME).get(key)
			req.onsuccess = () => resolve((req.result as LiveStateRecord | undefined) ?? null)
			req.onerror = () => reject(req.error)
		})
	} catch {
		return null
	}
}

async function saveLiveState(key: string, record: LiveStateRecord): Promise<void> {
	try {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite")
			const req = tx.objectStore(STORE_NAME).put(record, key)
			req.onsuccess = () => resolve()
			req.onerror = () => reject(req.error)
		})
	} catch {
		// ignore persistence errors
	}
}

async function clearLiveState(key: string): Promise<void> {
	try {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite")
			const req = tx.objectStore(STORE_NAME).delete(key)
			req.onsuccess = () => resolve()
			req.onerror = () => reject(req.error)
		})
	} catch {
		// ignore
	}
}

// ── AnyOn cast for diagram:change ────────────────────────────────────────────

type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void

// ── Plugin factory ────────────────────────────────────────────────────────────

export function createLiveModePlugin(options: LiveModeOptions): LiveModePlugin {
	const proxyUrl = (options.proxyUrl ?? "http://localhost:3033").replace(/\/$/, "")
	const pollIntervalMs = options.pollIntervalMs ?? 3000

	let canvasApi: CanvasApi | null = null
	const unsubs: Array<() => void> = []

	let _status: LiveModeStatus = "off"
	let _enabled = false
	let _profile: string | null = null
	let _instanceKey: string | null = null
	let _processDefinitionKey: string | null = null
	let _bpmnProcessId: string | null = null
	let _currentDefs: BpmnDefinitions | null = null
	let _activeElementIds = new Set<string>()

	let _pollTimer: ReturnType<typeof setInterval> | null = null
	let _deployDebounce: ReturnType<typeof setTimeout> | null = null

	// ── Conflict banner ───────────────────────────────────────────────────────

	let _conflictBanner: HTMLDivElement | null = null

	function removeConflictBanner(): void {
		if (_conflictBanner) {
			_conflictBanner.remove()
			_conflictBanner = null
		}
	}

	function showConflictBanner(conflictIds: string[], onFresh: () => void): void {
		removeConflictBanner()
		const container = canvasApi?.container
		if (!container) return

		const banner = document.createElement("div")
		banner.className = "bpmnkit-live-conflict"

		const title = document.createElement("div")
		title.className = "bpmnkit-live-conflict-title"
		title.textContent = "Migration conflict — instance is at removed elements"
		banner.appendChild(title)

		const list = document.createElement("ul")
		list.className = "bpmnkit-live-conflict-list"
		for (const id of conflictIds) {
			const item = document.createElement("li")
			item.className = "bpmnkit-live-conflict-item"
			item.textContent = id
			list.appendChild(item)
		}
		banner.appendChild(list)

		const btn = document.createElement("button")
		btn.className = "bpmnkit-live-btn"
		btn.textContent = "Start fresh"
		btn.addEventListener("click", () => {
			removeConflictBanner()
			onFresh()
		})
		banner.appendChild(btn)

		container.appendChild(banner)
		_conflictBanner = banner
	}

	// ── Variable inspector tooltip ────────────────────────────────────────────

	const tooltipEl = document.createElement("div")
	tooltipEl.className = "bpmnkit-live-vars-tooltip"
	tooltipEl.style.display = "none"
	document.body.appendChild(tooltipEl)

	let _tooltipDebounce: ReturnType<typeof setTimeout> | null = null
	let _tooltipElementId: string | null = null
	const _varsCache = new Map<string, Array<{ name: string; value: unknown }>>()

	function hideVarsTooltip(): void {
		tooltipEl.style.display = "none"
		_tooltipElementId = null
	}

	function showVarsTooltip(
		vars: Array<{ name: string; value: unknown }>,
		x: number,
		y: number,
	): void {
		while (tooltipEl.firstChild !== null) tooltipEl.removeChild(tooltipEl.firstChild)
		if (vars.length === 0) {
			hideVarsTooltip()
			return
		}
		for (const v of vars) {
			const row = document.createElement("div")
			row.className = "bpmnkit-live-vars-row"
			const nameEl = document.createElement("span")
			nameEl.className = "bpmnkit-live-vars-name"
			nameEl.textContent = v.name
			const valEl = document.createElement("span")
			valEl.className = "bpmnkit-live-vars-value"
			valEl.textContent = typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value)
			row.appendChild(nameEl)
			row.appendChild(valEl)
			tooltipEl.appendChild(row)
		}
		tooltipEl.style.display = "block"
		tooltipEl.style.left = `${x + 12}px`
		tooltipEl.style.top = `${y + 12}px`
	}

	function onMouseMove(e: MouseEvent): void {
		if (!_enabled || _instanceKey === null) {
			hideVarsTooltip()
			return
		}
		const target = (e.target as Element | null)?.closest("[data-bpmnkit-id]")
		const elementId = target?.getAttribute("data-bpmnkit-id") ?? null

		if (!elementId || !_activeElementIds.has(elementId)) {
			hideVarsTooltip()
			return
		}

		if (_tooltipElementId === elementId) return
		_tooltipElementId = elementId

		if (_tooltipDebounce !== null) clearTimeout(_tooltipDebounce)
		_tooltipDebounce = setTimeout(async () => {
			if (_tooltipElementId !== elementId || _instanceKey === null) return
			try {
				const cached = _varsCache.get(elementId)
				if (cached !== undefined) {
					showVarsTooltip(cached, e.clientX, e.clientY)
					return
				}
				const result = await proxyPost<{ items?: Array<{ name: string; value: unknown }> }>(
					"/api/v2/variables/search",
					{ filter: { processInstanceKey: _instanceKey } },
				)
				const vars = result.items ?? []
				_varsCache.set(elementId, vars)
				if (_tooltipElementId === elementId) {
					showVarsTooltip(vars, e.clientX, e.clientY)
				}
			} catch {
				hideVarsTooltip()
			}
		}, 300)
	}

	// ── Proxy helpers ─────────────────────────────────────────────────────────

	async function proxyGet<T>(path: string): Promise<T> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (_profile !== null) headers["x-profile"] = _profile
		const res = await fetch(`${proxyUrl}${path}`, { headers })
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		return res.json() as Promise<T>
	}

	async function proxyPost<T>(path: string, body: unknown): Promise<T> {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			accept: "application/json",
		}
		if (_profile !== null) headers["x-profile"] = _profile
		const res = await fetch(`${proxyUrl}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text()
			throw new Error(`HTTP ${res.status}: ${text}`)
		}
		return res.json() as Promise<T>
	}

	async function proxyPostMultipart<T>(path: string, form: FormData): Promise<T> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (_profile !== null) headers["x-profile"] = _profile
		const res = await fetch(`${proxyUrl}${path}`, {
			method: "POST",
			headers,
			body: form,
		})
		if (!res.ok) {
			const text = await res.text()
			throw new Error(`HTTP ${res.status}: ${text}`)
		}
		return res.json() as Promise<T>
	}

	// ── Status management ─────────────────────────────────────────────────────

	const toggleEl = document.createElement("button")
	toggleEl.className = "bpmnkit-live-toggle"
	toggleEl.textContent = "⚡ Live"

	const statusEl = document.createElement("span")
	statusEl.className = "bpmnkit-live-status bpmnkit-live-status--off"
	statusEl.textContent = "OFF"

	function setStatus(s: LiveModeStatus): void {
		_status = s
		options.onStatusChange?.(s)

		// Update toggle class
		toggleEl.className = "bpmnkit-live-toggle"
		if (s === "live") toggleEl.classList.add("bpmnkit-live-toggle--on")
		if (s === "blocked-production" || s === "tests-failing" || s === "error")
			toggleEl.classList.add("bpmnkit-live-toggle--blocked")

		// Update status pill
		const labelMap: Record<LiveModeStatus, string> = {
			off: "OFF",
			connecting: "CONNECTING",
			live: "LIVE",
			error: "ERROR",
			"blocked-production": "BLOCKED",
			"tests-failing": "TESTS FAIL",
		}
		statusEl.textContent = labelMap[s]
		statusEl.className = "bpmnkit-live-status"
		if (s === "off") statusEl.classList.add("bpmnkit-live-status--off")
		else if (s === "connecting") statusEl.classList.add("bpmnkit-live-status--connecting")
		else if (s === "live") statusEl.classList.add("bpmnkit-live-status--live")
		else if (s === "error") statusEl.classList.add("bpmnkit-live-status--error")
		else statusEl.classList.add("bpmnkit-live-status--blocked")
	}

	// ── Start new instance ────────────────────────────────────────────────────

	async function startNewInstance(bpmnProcessId: string, stateKey: string): Promise<string> {
		const res = await proxyPost<{ processInstanceKey?: string; key?: string }>(
			"/api/v2/process-instances",
			{ bpmnProcessId, variables: {} },
		)
		const key = res.processInstanceKey ?? res.key ?? ""
		if (!key) throw new Error("No instanceKey returned from start-instance")
		await saveLiveState(stateKey, {
			processDefinitionKey: _processDefinitionKey ?? "",
			instanceKey: key,
		})
		return key
	}

	// ── Polling ───────────────────────────────────────────────────────────────

	function stopPolling(): void {
		if (_pollTimer !== null) {
			clearInterval(_pollTimer)
			_pollTimer = null
		}
	}

	function startPolling(): void {
		stopPolling()
		_pollTimer = setInterval(async () => {
			if (!_enabled || _instanceKey === null) return
			try {
				const res = await proxyPost<{
					items?: Array<{ elementId?: string }>
				}>("/api/v2/element-instances/search", {
					filter: { processInstanceKey: _instanceKey, state: "ACTIVE" },
				})
				const ids = (res.items ?? []).flatMap((item) =>
					item.elementId !== undefined ? [item.elementId] : [],
				)
				_activeElementIds = new Set(ids)
				options.tokenHighlight?.api.setActive(ids)
				options.tokenHighlight?.api.addVisited(ids)
				_varsCache.clear()
			} catch {
				// Instance may be gone — try to start a new one
				if (_bpmnProcessId !== null && _profile !== null) {
					const stateKey = `${_profile}:${_bpmnProcessId}`
					try {
						await clearLiveState(stateKey)
						const newKey = await startNewInstance(_bpmnProcessId, stateKey)
						_instanceKey = newKey
					} catch {
						// give up polling silently
					}
				}
			}
		}, pollIntervalMs)
	}

	// ── Migration ─────────────────────────────────────────────────────────────

	async function attemptMigration(
		instanceKey: string,
		targetProcessDefinitionKey: string,
		currentDefs: BpmnDefinitions | null,
	): Promise<void> {
		// Build mapping instructions using current element IDs
		const currentProcess = currentDefs?.processes[0]
		const currentElementIds = currentProcess
			? new Set(currentProcess.flowElements.map((el) => el.id))
			: new Set<string>()

		const mappingInstructions = [...currentElementIds].map((id) => ({
			sourceElementId: id,
			targetElementId: id,
		}))

		await proxyPost(`/api/v2/process-instances/${instanceKey}/migration`, {
			targetProcessDefinitionKey,
			mappingInstructions,
		})
	}

	// ── Deploy flow ───────────────────────────────────────────────────────────

	async function deploy(): Promise<void> {
		try {
			const profile = options.getProfile?.() ?? null
			if (profile?.isProduction === true) {
				setStatus("blocked-production")
				return
			}
			_profile = profile?.name ?? null

			if (options.requireTestsGreen === true && options.runTests !== undefined) {
				const passed = await options.runTests()
				if (!passed) {
					setStatus("tests-failing")
					return
				}
			}

			setStatus("connecting")

			const xml = options.getXml()
			if (!xml) throw new Error("No XML available")
			const fileName = options.getFileName?.() ?? "process.bpmn"

			const form = new FormData()
			form.append("resources", new Blob([xml], { type: "application/xml" }), fileName)

			const deployResult = await proxyPostMultipart<{
				deploymentKey?: string
				processes?: Array<{ processDefinitionKey?: string; bpmnProcessId?: string }>
			}>("/api/deployments", form)

			const firstProcess = deployResult.processes?.[0]
			const newProcessDefinitionKey = firstProcess?.processDefinitionKey ?? ""
			const newBpmnProcessId = firstProcess?.bpmnProcessId ?? ""

			_processDefinitionKey = newProcessDefinitionKey
			_bpmnProcessId = newBpmnProcessId

			const stateKey = `${_profile ?? "_"}:${newBpmnProcessId}`
			const stored = await loadLiveState(stateKey)

			if (stored?.instanceKey) {
				// Try migration
				try {
					await attemptMigration(stored.instanceKey, newProcessDefinitionKey, _currentDefs)
					_instanceKey = stored.instanceKey
					await saveLiveState(stateKey, {
						processDefinitionKey: newProcessDefinitionKey,
						instanceKey: stored.instanceKey,
					})
				} catch {
					// Migration failed — show conflict banner and start fresh
					removeConflictBanner()
					const currentProcess = _currentDefs?.processes[0]
					const currentIds = new Set(currentProcess?.flowElements.map((el) => el.id) ?? [])
					const conflicts = [...currentIds].filter((id) => !currentIds.has(id))
					showConflictBanner(conflicts.length > 0 ? conflicts : [stored.instanceKey], async () => {
						await clearLiveState(stateKey)
						try {
							const newKey = await startNewInstance(newBpmnProcessId, stateKey)
							_instanceKey = newKey
							startPolling()
						} catch {
							setStatus("error")
						}
					})
					const newKey = await startNewInstance(newBpmnProcessId, stateKey)
					_instanceKey = newKey
				}
			} else {
				const newKey = await startNewInstance(newBpmnProcessId, stateKey)
				_instanceKey = newKey
			}

			setStatus("live")
			startPolling()
		} catch {
			setStatus("error")
		}
	}

	function scheduleDeploy(): void {
		if (!_enabled) return
		if (_deployDebounce !== null) clearTimeout(_deployDebounce)
		_deployDebounce = setTimeout(() => {
			deploy().catch(() => setStatus("error"))
		}, 500)
	}

	// ── Toggle logic ──────────────────────────────────────────────────────────

	function enable(): void {
		_enabled = true
		scheduleDeploy()
	}

	function disable(): void {
		_enabled = false
		stopPolling()
		if (_deployDebounce !== null) clearTimeout(_deployDebounce)
		options.tokenHighlight?.api.clear()
		_activeElementIds.clear()
		_instanceKey = null
		setStatus("off")
		removeConflictBanner()
		hideVarsTooltip()
	}

	toggleEl.addEventListener("click", () => {
		if (_enabled) {
			disable()
		} else {
			enable()
		}
	})

	// ── Canvas install/uninstall ──────────────────────────────────────────────

	return {
		name: "live-mode",
		toggle: toggleEl,
		status: statusEl,
		disable,

		install(api: CanvasApi): void {
			canvasApi = api
			injectLiveModeStyles()

			// Listen for diagram changes
			const onAny = api.on as unknown as AnyOn
			unsubs.push(
				onAny("diagram:load", (arg: unknown) => {
					const defs = (arg as { definitions?: BpmnDefinitions } | null)?.definitions ?? null
					_currentDefs = defs
					if (_enabled) scheduleDeploy()
				}),
			)
			unsubs.push(
				onAny("diagram:change", (arg: unknown) => {
					const defs = (arg as { definitions?: BpmnDefinitions } | null)?.definitions ?? null
					if (defs !== null) _currentDefs = defs
					if (_enabled) scheduleDeploy()
				}),
			)

			// Variable inspector mousemove
			const viewport = api.container
			if (viewport) {
				viewport.addEventListener("mousemove", onMouseMove)
				unsubs.push(() => viewport.removeEventListener("mousemove", onMouseMove))
			}
		},

		uninstall(): void {
			disable()
			for (const unsub of unsubs) unsub()
			unsubs.length = 0
			tooltipEl.remove()
			canvasApi = null
		},
	}
}
