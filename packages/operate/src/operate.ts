import { injectOperateStyles } from "./css.js"
import { createRouter } from "./router.js"
import { DashboardStore } from "./stores/dashboard.js"
import { DefinitionsStore } from "./stores/definitions.js"
import { IncidentsStore } from "./stores/incidents.js"
import { InstancesStore } from "./stores/instances.js"
import { JobsStore } from "./stores/jobs.js"
import { TasksStore } from "./stores/tasks.js"
import type { OperateApi, OperateOptions, ProfileInfo, Theme } from "./types.js"
import { createDashboardView } from "./views/dashboard.js"
import { createDefinitionsView } from "./views/definitions.js"
import { createHeader } from "./views/header.js"
import { createIncidentsView } from "./views/incidents.js"
import { createInstanceDetailView } from "./views/instance-detail.js"
import { createInstancesView } from "./views/instances.js"
import { createJobsView } from "./views/jobs.js"
import { createNav } from "./views/nav.js"
import { createTasksView } from "./views/tasks.js"

const TITLE_MAP: Record<string, string> = {
	"/": "Dashboard",
	"/definitions": "Processes",
	"/instances": "Instances",
	"/incidents": "Incidents",
	"/jobs": "Jobs",
	"/tasks": "Tasks",
}

export function createOperate(options: OperateOptions): OperateApi {
	injectOperateStyles()

	const {
		container,
		proxyUrl = "http://localhost:3033",
		theme = "auto",
		pollInterval = 30_000,
		mock = false,
	} = options

	let profile: string | null = options.profile ?? null

	// ── Root element ──────────────────────────────────────────────────────────

	const el = document.createElement("div")
	el.className = "op-root"
	el.setAttribute("data-theme", resolveTheme(theme))
	container.appendChild(el)

	// ── Stores ────────────────────────────────────────────────────────────────

	const dashStore = new DashboardStore()
	const defStore = new DefinitionsStore()
	const instStore = new InstancesStore()
	const incStore = new IncidentsStore()
	const jobStore = new JobsStore()
	const taskStore = new TasksStore()

	function connectAll(): void {
		dashStore.connect(proxyUrl, profile, pollInterval, mock)
		defStore.connect(proxyUrl, profile, pollInterval, mock)
		instStore.connect(proxyUrl, profile, pollInterval, mock)
		incStore.connect(proxyUrl, profile, pollInterval, mock)
		jobStore.connect(proxyUrl, profile, pollInterval, mock)
		taskStore.connect(proxyUrl, profile, pollInterval, mock)
	}

	connectAll()

	// ── Profiles ──────────────────────────────────────────────────────────────

	let profiles: ProfileInfo[] = []

	if (!mock) {
		fetchProfiles()
	} else {
		// Demo profiles for mock mode
		profiles = [{ name: "demo", active: true, apiType: "saas", baseUrl: null, authType: "none" }]
	}

	function fetchProfiles(): void {
		fetch(`${proxyUrl}/profiles`)
			.then((r) => r.json())
			.then((data: ProfileInfo[]) => {
				profiles = data
				const active = data.find((p) => p.active)
				if (!profile && active) profile = active.name
				header.setProfiles(profiles, profile)
			})
			.catch(() => {
				// proxy not running — silently ignore in mock mode
			})
	}

	// ── Layout ────────────────────────────────────────────────────────────────

	const layout = document.createElement("div")
	layout.className = "op-layout"
	el.appendChild(layout)

	const router = createRouter()

	const nav = createNav((path) => router.navigate(path))
	layout.appendChild(nav.el)

	const main = document.createElement("div")
	main.className = "op-main"
	layout.appendChild(main)

	const header = createHeader((name) => {
		profile = name
		connectAll()
	})
	header.setProfiles(profiles, profile)
	main.appendChild(header.el)

	const content = document.createElement("div")
	content.className = "op-content"
	main.appendChild(content)

	// ── Router ────────────────────────────────────────────────────────────────

	let destroyView: (() => void) | null = null

	function showView(viewEl: HTMLElement, destroy: () => void): void {
		destroyView?.()
		destroyView = destroy
		content.innerHTML = ""
		content.appendChild(viewEl)
	}

	router.on("/", () => {
		header.setTitle("Dashboard")
		nav.setActive("/")
		const { el: vEl, destroy } = createDashboardView(dashStore, (path) => router.navigate(path))
		showView(vEl, destroy)
	})

	router.on("/definitions", () => {
		header.setTitle("Processes")
		nav.setActive("/definitions")
		const { el: vEl, destroy } = createDefinitionsView(defStore, (def) => {
			router.navigate(`/definitions/${def.processDefinitionKey ?? ""}`)
		})
		showView(vEl, destroy)
	})

	router.on("/definitions/:key", (params) => {
		header.setTitle("Process Definition")
		nav.setActive("/definitions")
		// For now, navigate to instances filtered by this definition
		instStore.destroy()
		instStore.connect(proxyUrl, profile, pollInterval, mock, {
			processDefinitionKey: params.key,
		})
		const { el: vEl, destroy } = createInstancesView(instStore, (inst) =>
			router.navigate(`/instances/${inst.processInstanceKey}`),
		)
		showView(vEl, destroy)
	})

	router.on("/instances", () => {
		header.setTitle("Instances")
		nav.setActive("/instances")
		instStore.connect(proxyUrl, profile, pollInterval, mock)
		const { el: vEl, destroy } = createInstancesView(
			instStore,
			(inst) => router.navigate(`/instances/${inst.processInstanceKey}`),
			(state) => {
				instStore.connect(proxyUrl, profile, pollInterval, mock, { state: state || undefined })
			},
		)
		showView(vEl, destroy)
	})

	router.on("/instances/:key", (params) => {
		const title = `Instance ${params.key}`
		header.setTitle(title)
		nav.setActive("/instances")
		const { el: vEl, destroy } = createInstanceDetailView(
			params.key ?? "",
			instStore,
			{
				proxyUrl,
				profile,
				interval: pollInterval,
				mock,
				theme: resolveTheme(theme),
			},
			() => router.navigate("/instances"),
		)
		showView(vEl, destroy)
	})

	router.on("/incidents", () => {
		header.setTitle("Incidents")
		nav.setActive("/incidents")
		const { el: vEl, destroy } = createIncidentsView(incStore)
		showView(vEl, destroy)
	})

	router.on("/jobs", () => {
		header.setTitle("Jobs")
		nav.setActive("/jobs")
		const { el: vEl, destroy } = createJobsView(jobStore)
		showView(vEl, destroy)
	})

	router.on("/tasks", () => {
		header.setTitle("Tasks")
		nav.setActive("/tasks")
		const { el: vEl, destroy } = createTasksView(taskStore)
		showView(vEl, destroy)
	})

	const stopRouter = router.start()

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		el,

		setProfile(name: string | null): void {
			profile = name
			connectAll()
			header.setProfiles(profiles, profile)
		},

		setTheme(t: Theme): void {
			el.setAttribute("data-theme", resolveTheme(t))
		},

		navigate(path: string): void {
			router.navigate(path)
		},

		destroy(): void {
			stopRouter()
			destroyView?.()
			dashStore.destroy()
			defStore.destroy()
			instStore.destroy()
			incStore.destroy()
			jobStore.destroy()
			taskStore.destroy()
			el.remove()
		},
	}
}

function resolveTheme(theme: Theme): "light" | "dark" {
	if (theme === "auto") {
		return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
	}
	return theme
}
