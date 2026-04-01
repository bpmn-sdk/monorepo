import { create } from "zustand"
import { ProxyFsAdapter, setActiveAdapter } from "../storage/index.js"
import { IndexedDbAdapter, sharedIndexedDb } from "../storage/indexeddb.js"
import type { Project } from "../storage/types.js"
import { useModelsStore } from "./models.js"

const ACTIVE_KEY = "bpmnkit-studio-active-project"

interface ProjectsState {
	projects: Project[]
	activeProjectId: string | null
	loaded: boolean
	load(): Promise<void>
	addProject(name: string, path: string): Promise<Project>
	removeProject(id: string): Promise<void>
	setActiveProject(id: string | null, proxyUrl: string): void
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
	projects: [],
	activeProjectId: null,
	loaded: false,

	async load() {
		const projects = await sharedIndexedDb.listProjects()
		const activeId = localStorage.getItem(ACTIVE_KEY)
		set({ projects, activeProjectId: activeId, loaded: true })
	},

	async addProject(name, path) {
		const project: Project = {
			id: crypto.randomUUID(),
			name,
			path,
			lastUsed: Date.now(),
		}
		await sharedIndexedDb.saveProject(project)
		set((s) => ({ projects: [...s.projects, project] }))
		return project
	},

	async removeProject(id) {
		await sharedIndexedDb.deleteProject(id)
		const { activeProjectId } = get()
		if (activeProjectId === id) {
			get().setActiveProject(null, "")
		}
		set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
	},

	setActiveProject(id, proxyUrl) {
		if (id === null) {
			setActiveAdapter(new IndexedDbAdapter())
			localStorage.removeItem(ACTIVE_KEY)
		} else {
			const project = get().projects.find((p) => p.id === id)
			if (!project) return
			setActiveAdapter(new ProxyFsAdapter(proxyUrl, project.path))
			localStorage.setItem(ACTIVE_KEY, id)
			// Update lastUsed
			const updated = { ...project, lastUsed: Date.now() }
			void sharedIndexedDb.saveProject(updated)
			set((s) => ({
				projects: s.projects.map((p) => (p.id === id ? updated : p)),
			}))
		}
		set({ activeProjectId: id })
		// Reload models from the new adapter
		void useModelsStore.getState().loadModels()
	},
}))
