import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { renderStoryHtml } from "@bpmnkit/core"
import { injectStoryViewStyles } from "./css.js"

// ── Public types ─────────────────────────────────────────────────────────────

export interface StoryComment {
	id: string
	text: string
	author: string
	createdAt: number
	resolved?: boolean
}

export interface StoryViewOptions {
	/** Container element to mount the story view into. */
	container?: HTMLElement
	/** Called when user clicks "← Edit" to return to edit mode. */
	onEditMode?: () => void
	/** Optional: return a plain English summary of a FEEL condition. Cache per condition. */
	summarizeCondition?: (condition: string) => Promise<string>
	/** Returns a unique key for the current file (for comment persistence). */
	getFileKey?: () => string | null
	/** Theme passed to renderStoryHtml. */
	getTheme?: () => "dark" | "light"
	/** Returns the author name to use when adding comments. Defaults to "You". */
	getAuthorName?: () => string
}

export interface StoryViewPlugin extends CanvasPlugin {
	readonly name: "story-view"
	/** Toggle button that switches between Story and Edit mode. */
	readonly toggle: HTMLButtonElement
	/** Enter story mode programmatically. */
	enterStoryMode(): void
	/** Exit story mode programmatically. */
	exitStoryMode(): void
}

// ── AnyOn cast ────────────────────────────────────────────────────────────────

type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

const SV_DB_NAME = "bpmnkit-story-view-v1"
const SV_STORE = "comments"

function openSvDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(SV_DB_NAME, 1)
		req.onupgradeneeded = () => {
			req.result.createObjectStore(SV_STORE)
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

async function loadComments(key: string): Promise<StoryComment[]> {
	try {
		const db = await openSvDb()
		return new Promise((resolve, reject) => {
			const tx = db.transaction(SV_STORE, "readonly")
			const req = tx.objectStore(SV_STORE).get(key)
			req.onsuccess = () => resolve((req.result as StoryComment[] | undefined) ?? [])
			req.onerror = () => reject(req.error)
		})
	} catch {
		return []
	}
}

async function saveComments(key: string, comments: StoryComment[]): Promise<void> {
	try {
		const db = await openSvDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(SV_STORE, "readwrite")
			const req = tx.objectStore(SV_STORE).put(comments, key)
			req.onsuccess = () => resolve()
			req.onerror = () => reject(req.error)
		})
	} catch {
		// ignore
	}
}

// ── Plugin factory ────────────────────────────────────────────────────────────

export function createStoryViewPlugin(options?: StoryViewOptions): StoryViewPlugin {
	let canvasApi: CanvasApi | null = null
	let currentDefs: BpmnDefinitions | null = null
	let storyActive = false
	const unsubs: Array<() => void> = []
	const conditionCache = new Map<string, string>()

	// Mounted story root
	let storyRoot: HTMLElement | null = null

	// Toggle button
	const toggleEl = document.createElement("button")
	toggleEl.textContent = "📖 Story"
	toggleEl.className = "bpmnkit-sv-toggle"

	// ── Comment panel per card ────────────────────────────────────────────────

	async function buildCommentPanel(elementId: string, container: HTMLElement): Promise<void> {
		const fileKey = options?.getFileKey?.() ?? "_"
		const commentKey = `${fileKey}:${elementId}`
		let comments = await loadComments(commentKey)

		function renderComments(): void {
			// Clear existing comment items (keep input/submit)
			const existing = container.querySelectorAll(".bpmnkit-sv-comment-item")
			for (const el of existing) el.remove()

			const input = container.querySelector<HTMLTextAreaElement>(".bpmnkit-sv-comment-input")
			for (const c of comments) {
				const item = document.createElement("div")
				item.className = c.resolved
					? "bpmnkit-sv-comment-item bpmnkit-sv-comment-item--resolved"
					: "bpmnkit-sv-comment-item"
				const textEl = document.createElement("div")
				textEl.className = "bpmnkit-sv-comment-text"
				textEl.textContent = c.text
				const meta = document.createElement("div")
				meta.className = "bpmnkit-sv-comment-meta"
				meta.textContent = `${c.author} · ${new Date(c.createdAt).toLocaleString()}`
				const resolveBtn = document.createElement("button")
				resolveBtn.className = "bpmnkit-sv-comment-resolve"
				resolveBtn.textContent = c.resolved ? "Unresolve" : "Resolve"
				resolveBtn.addEventListener("click", async () => {
					comments = comments.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x))
					await saveComments(commentKey, comments)
					renderComments()
				})
				item.appendChild(textEl)
				item.appendChild(meta)
				item.appendChild(resolveBtn)
				// Insert before the input
				if (input !== null) {
					container.insertBefore(item, input)
				} else {
					container.appendChild(item)
				}
			}
		}

		const inputEl = document.createElement("textarea")
		inputEl.className = "bpmnkit-sv-comment-input"
		inputEl.placeholder = "Add a comment…"

		const submitEl = document.createElement("button")
		submitEl.className = "bpmnkit-sv-comment-submit"
		submitEl.textContent = "Add"
		submitEl.addEventListener("click", async () => {
			const text = inputEl.value.trim()
			if (!text) return
			const comment: StoryComment = {
				id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				text,
				author: options?.getAuthorName?.() ?? "You",
				createdAt: Date.now(),
			}
			comments = [...comments, comment]
			await saveComments(commentKey, comments)
			inputEl.value = ""
			renderComments()
			updateBadge()
		})

		container.appendChild(inputEl)
		container.appendChild(submitEl)
		renderComments()

		function updateBadge(): void {
			const btn = container.closest(".bpmnkit-sv-card")?.querySelector(".bpmnkit-sv-comment-btn")
			if (btn !== null && btn !== undefined) {
				btn.textContent = comments.length > 0 ? `💬 ${comments.length}` : "💬"
			}
		}
	}

	// ── Wire comment buttons in story HTML ───────────────────────────────────

	async function wireCommentButtons(root: HTMLElement): Promise<void> {
		const cards = root.querySelectorAll<HTMLElement>("[data-bpmnkit-id]")
		for (const card of cards) {
			const elementId = card.getAttribute("data-bpmnkit-id")
			if (!elementId) continue

			const fileKey = options?.getFileKey?.() ?? "_"
			const commentKey = `${fileKey}:${elementId}`
			const comments = await loadComments(commentKey)

			const btn = document.createElement("button")
			btn.className = "bpmnkit-sv-comment-btn"
			btn.textContent = comments.length > 0 ? `💬 ${comments.length}` : "💬"

			let panelOpen = false
			let panelEl: HTMLDivElement | null = null

			btn.addEventListener("click", async () => {
				panelOpen = !panelOpen
				if (panelOpen) {
					panelEl = document.createElement("div")
					panelEl.className = "bpmnkit-sv-comment-panel"
					await buildCommentPanel(elementId, panelEl)
					card.appendChild(panelEl)
				} else if (panelEl !== null) {
					panelEl.remove()
					panelEl = null
				}
			})

			card.appendChild(btn)
		}
	}

	// ── AI condition summarizer ──────────────────────────────────────────────

	async function applyConditionSummaries(root: HTMLElement): Promise<void> {
		if (!options?.summarizeCondition) return
		const conditionExprs = root.querySelectorAll<HTMLElement>(".bks-condition-expr")
		for (const el of conditionExprs) {
			const original = el.textContent ?? ""
			if (!original) continue
			const cached = conditionCache.get(original)
			if (cached !== undefined) {
				el.title = original
				el.textContent = cached
				continue
			}
			options
				.summarizeCondition(original)
				.then((summary) => {
					conditionCache.set(original, summary)
					el.title = original
					el.textContent = summary
				})
				.catch(() => {
					// leave as-is on error
				})
		}
	}

	// ── Enter / exit story mode ──────────────────────────────────────────────

	function enterStoryMode(): void {
		if (storyActive) return
		storyActive = true
		toggleEl.classList.add("bpmnkit-sv-toggle--active")

		const defs = currentDefs
		const theme = options?.getTheme?.() ?? "dark"
		const container = options?.container ?? canvasApi?.container
		if (!container) return

		const html = defs !== null ? renderStoryHtml(defs, { standalone: false, theme }) : ""

		storyRoot = document.createElement("div")
		storyRoot.className = "bpmnkit-sv-container"
		if (theme === "light") storyRoot.setAttribute("data-bpmnkit-theme", "light")

		// Header
		const header = document.createElement("div")
		header.className = "bpmnkit-sv-header"
		const title = document.createElement("div")
		title.className = "bpmnkit-sv-title"
		title.textContent = defs?.processes[0]?.name ?? "Process Story"
		const backBtn = document.createElement("button")
		backBtn.className = "bpmnkit-sv-back"
		backBtn.textContent = "← Edit"
		backBtn.addEventListener("click", () => exitStoryMode())
		header.appendChild(backBtn)
		header.appendChild(title)

		const shareBtn = document.createElement("button")
		shareBtn.className = "bpmnkit-sv-share"
		shareBtn.textContent = "\u2193 Download"
		shareBtn.addEventListener("click", () => {
			if (defs === null) return
			const storyHtml = renderStoryHtml(defs, { standalone: true, theme })
			const blob = new Blob([storyHtml], { type: "text/html" })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = `${defs.processes[0]?.name ?? "process"}-story.html`
			a.click()
			URL.revokeObjectURL(url)
		})
		header.appendChild(shareBtn)

		// Content
		const content = document.createElement("div")
		content.className = "bpmnkit-sv-content"
		content.innerHTML = html

		storyRoot.appendChild(header)
		storyRoot.appendChild(content)
		container.appendChild(storyRoot)

		wireCommentButtons(content).catch(() => undefined)
		applyConditionSummaries(content).catch(() => undefined)
	}

	function exitStoryMode(): void {
		if (!storyActive) return
		storyActive = false
		toggleEl.classList.remove("bpmnkit-sv-toggle--active")
		if (storyRoot !== null) {
			storyRoot.remove()
			storyRoot = null
		}
		options?.onEditMode?.()
	}

	toggleEl.addEventListener("click", () => {
		if (storyActive) {
			exitStoryMode()
		} else {
			enterStoryMode()
		}
	})

	return {
		name: "story-view",
		toggle: toggleEl,
		enterStoryMode,
		exitStoryMode,

		install(api: CanvasApi): void {
			canvasApi = api
			injectStoryViewStyles()

			const onAny = api.on as unknown as AnyOn
			unsubs.push(
				onAny("diagram:load", (arg: unknown) => {
					const defs = (arg as { definitions?: BpmnDefinitions } | null)?.definitions ?? null
					currentDefs = defs
					if (storyActive) {
						exitStoryMode()
						enterStoryMode()
					}
				}),
			)
			unsubs.push(
				onAny("diagram:change", (arg: unknown) => {
					const defs = (arg as { definitions?: BpmnDefinitions } | null)?.definitions ?? null
					if (defs !== null) currentDefs = defs
				}),
			)
		},

		uninstall(): void {
			exitStoryMode()
			for (const unsub of unsubs) unsub()
			unsubs.length = 0
			canvasApi = null
		},
	}
}
