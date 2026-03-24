import type { FormDefinition } from "@bpmnkit/core"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { applyTheme, injectUiStyles } from "@bpmnkit/ui"
import { claimTask, completeTask, fetchTaskForm, unclaimTask } from "./actions.js"
import type { UserTask, UserTaskWidgetApi, UserTaskWidgetOptions } from "./types.js"

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const e = document.createElement(tag)
	e.className = className
	if (text !== undefined) e.textContent = text
	return e
}

const WIDGET_CSS = `
.ut-root { font-family: var(--bpmnkit-font, system-ui, sans-serif); color: var(--bpmnkit-fg, #1a1a2e); }
.ut-header { padding: 16px; border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8); }
.ut-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.ut-meta { display: flex; gap: 12px; font-size: 13px; color: var(--bpmnkit-fg-muted, #6666a0); }
.ut-meta-item { display: flex; align-items: center; gap: 4px; }
.ut-overdue { color: var(--bpmnkit-danger, #dc2626); }
.ut-form { padding: 16px; flex: 1; overflow-y: auto; }
.ut-form-placeholder { padding: 32px; text-align: center; color: var(--bpmnkit-fg-muted, #6666a0); font-size: 14px; }
.ut-actions { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--bpmnkit-border, #d0d0e8); }
.ut-btn { padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; border: 1px solid transparent; transition: opacity 0.15s; }
.ut-btn:hover { opacity: 0.85; }
.ut-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ut-btn-primary { background: var(--bpmnkit-accent, #1a56db); color: var(--bpmnkit-accent-fg, #fff); }
.ut-btn-secondary { background: transparent; border-color: var(--bpmnkit-border, #d0d0e8); color: var(--bpmnkit-fg, #1a1a2e); }
.ut-btn-danger { background: var(--bpmnkit-danger, #dc2626); color: #fff; }
.ut-error { padding: 8px 12px; background: color-mix(in srgb, var(--bpmnkit-danger, #dc2626) 15%, transparent); color: var(--bpmnkit-danger, #dc2626); border-radius: 4px; font-size: 13px; margin: 0 16px 8px; }
`

function injectWidgetStyles(): void {
	const id = "bpmnkit-user-tasks-css"
	if (document.getElementById(id)) return
	const style = document.createElement("style")
	style.id = id
	style.textContent = WIDGET_CSS
	document.head.appendChild(style)
}

export function createUserTaskWidget(options: UserTaskWidgetOptions): UserTaskWidgetApi {
	injectUiStyles()
	injectWidgetStyles()

	const {
		container,
		proxyUrl = "http://localhost:3033",
		profile = null,
		theme = "neon",
		onComplete,
		onClaim,
		onUnclaim,
		onReject,
	} = options

	// Create root element
	const root = el("div", "ut-root")
	applyTheme(root, theme)
	root.style.display = "flex"
	root.style.flexDirection = "column"
	root.style.height = "100%"
	container.appendChild(root)

	// State
	let currentTask: UserTask = options.task
	let formViewer: FormViewer | null = null
	let formVariables: Record<string, unknown> = {}

	// Error area
	const errorEl = el("div", "ut-error")
	errorEl.style.display = "none"

	// Header
	const header = el("div", "ut-header")
	const nameEl = el("div", "ut-name")
	const metaEl = el("div", "ut-meta")
	header.appendChild(nameEl)
	header.appendChild(metaEl)
	root.appendChild(header)
	root.appendChild(errorEl)

	// Form area
	const formArea = el("div", "ut-form")
	const formContainer = el("div", "")
	formArea.appendChild(formContainer)
	root.appendChild(formArea)

	// Actions
	const actionsEl = el("div", "ut-actions")
	const claimBtn = el("button", "ut-btn ut-btn-secondary", "Claim")
	claimBtn.type = "button"
	const unclaimBtn = el("button", "ut-btn ut-btn-secondary", "Unclaim")
	unclaimBtn.type = "button"
	const completeBtn = el("button", "ut-btn ut-btn-primary", "Complete")
	completeBtn.type = "button"
	const rejectBtn = el("button", "ut-btn ut-btn-danger", "Reject")
	rejectBtn.type = "button"

	if (!onReject) rejectBtn.style.display = "none"

	actionsEl.appendChild(claimBtn)
	actionsEl.appendChild(unclaimBtn)
	actionsEl.appendChild(completeBtn)
	if (onReject) actionsEl.appendChild(rejectBtn)
	root.appendChild(actionsEl)

	function showError(msg: string): void {
		errorEl.textContent = msg
		errorEl.style.display = "block"
	}

	function clearError(): void {
		errorEl.style.display = "none"
	}

	function renderTask(task: UserTask): void {
		nameEl.textContent = task.name ?? `Task ${task.userTaskKey}`

		metaEl.innerHTML = ""

		if (task.assignee) {
			const assigneeItem = el("span", "ut-meta-item")
			assigneeItem.textContent = `Assigned to ${task.assignee}`
			metaEl.appendChild(assigneeItem)
		}

		if (task.dueDate) {
			const due = new Date(task.dueDate)
			const overdue = due < new Date()
			const dueItem = el("span", overdue ? "ut-meta-item ut-overdue" : "ut-meta-item")
			dueItem.textContent = `Due: ${due.toLocaleDateString()}${overdue ? " (overdue)" : ""}`
			metaEl.appendChild(dueItem)
		}

		if (task.priority !== undefined) {
			const priorityItem = el("span", "ut-meta-item")
			priorityItem.textContent = `Priority: ${task.priority}`
			metaEl.appendChild(priorityItem)
		}

		// Update button states
		claimBtn.disabled = !!task.assignee
		unclaimBtn.disabled = !task.assignee

		// Load form
		void loadForm(task)
	}

	async function loadForm(task: UserTask): Promise<void> {
		// Clean up existing viewer
		if (formViewer) {
			formViewer.destroy()
			formViewer = null
		}
		formContainer.innerHTML = ""

		try {
			const formData = await fetchTaskForm(proxyUrl, profile, task.userTaskKey)
			if (formData && typeof formData === "object" && "components" in formData) {
				formViewer = new FormViewer({ container: formContainer, theme: "dark" })
				formViewer.load(formData as FormDefinition)
			} else {
				const placeholder = el("div", "ut-form-placeholder", "No form associated with this task.")
				formContainer.appendChild(placeholder)
			}
		} catch {
			const placeholder = el(
				"div",
				"ut-form-placeholder",
				"No form schema found or form is embedded in the process.",
			)
			formContainer.appendChild(placeholder)
		}
	}

	// Event handlers
	claimBtn.addEventListener("click", () => {
		claimBtn.disabled = true
		claimBtn.textContent = "Claiming..."
		claimTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey }, "studio-user")
			.then(() => {
				clearError()
				onClaim()
			})
			.catch((err: unknown) => {
				showError(`Claim failed: ${err instanceof Error ? err.message : String(err)}`)
			})
			.finally(() => {
				claimBtn.textContent = "Claim"
			})
	})

	unclaimBtn.addEventListener("click", () => {
		unclaimBtn.disabled = true
		unclaimBtn.textContent = "Unclaiming..."
		unclaimTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey })
			.then(() => {
				clearError()
				onUnclaim()
			})
			.catch((err: unknown) => {
				showError(`Unclaim failed: ${err instanceof Error ? err.message : String(err)}`)
			})
			.finally(() => {
				unclaimBtn.textContent = "Unclaim"
			})
	})

	completeBtn.addEventListener("click", () => {
		completeBtn.disabled = true
		completeBtn.textContent = "Completing..."
		completeTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey }, formVariables)
			.then(() => {
				clearError()
				onComplete(formVariables)
			})
			.catch((err: unknown) => {
				showError(`Complete failed: ${err instanceof Error ? err.message : String(err)}`)
				completeBtn.disabled = false
			})
			.finally(() => {
				completeBtn.textContent = "Complete"
			})
	})

	rejectBtn.addEventListener("click", () => {
		const reason = window.prompt("Reason for rejection (optional):", "") ?? ""
		if (onReject) onReject(reason)
	})

	// Initial render
	renderTask(currentTask)

	return {
		setTask(task: UserTask) {
			currentTask = task
			formVariables = {}
			renderTask(task)
		},

		destroy() {
			formViewer?.destroy()
			formViewer = null
			root.remove()
		},
	}
}
