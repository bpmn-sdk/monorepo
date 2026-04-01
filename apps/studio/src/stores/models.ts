import { create } from "zustand"
import { getFsAdapter, storage } from "../storage/index.js"
import type { ModelFile } from "../storage/index.js"

interface ModelsState {
	models: ModelFile[]
	loaded: boolean
	loading: boolean
	loadModels(): Promise<void>
	loadModel(id: string): Promise<ModelFile | null>
	saveModel(m: Omit<ModelFile, "updatedAt">): Promise<ModelFile>
	deleteModel(id: string): Promise<void>
	upsertModel(m: ModelFile): void
	moveModel(fromRelPath: string, toRelPath: string): Promise<ModelFile>
}

export const useModelsStore = create<ModelsState>()((set, get) => ({
	models: [],
	loaded: false,
	loading: false,

	async loadModels() {
		set({ loading: true })
		const models = await storage.listModels()
		set({ models, loaded: true, loading: false })
	},

	async loadModel(id) {
		const full = await storage.getModel(id)
		if (full) get().upsertModel(full)
		return full
	},

	async saveModel(m) {
		const saved = await storage.saveModel(m)
		get().upsertModel(saved)
		return saved
	},

	async deleteModel(id) {
		await storage.deleteModel(id)
		set((s) => ({ models: s.models.filter((m) => m.id !== id) }))
	},

	upsertModel(m) {
		set((s) => {
			const idx = s.models.findIndex((x) => x.id === m.id)
			if (idx >= 0) {
				const next = [...s.models]
				next[idx] = m
				return { models: next }
			}
			return { models: [...s.models, m] }
		})
	},

	async moveModel(fromRelPath, toRelPath) {
		const fs = getFsAdapter()
		if (!fs) throw new Error("moveModel requires FS mode")
		const moved = await fs.moveModel(fromRelPath, toRelPath)
		get().upsertModel(moved)
		return moved
	},
}))
