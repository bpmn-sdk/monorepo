import { create } from "zustand"
import { storage } from "../storage/index.js"
import type { ModelFile } from "../storage/index.js"

interface ModelsState {
	models: ModelFile[]
	loaded: boolean
	loadModels(): Promise<void>
	saveModel(m: Omit<ModelFile, "updatedAt">): Promise<ModelFile>
	deleteModel(id: string): Promise<void>
	upsertModel(m: ModelFile): void
}

export const useModelsStore = create<ModelsState>()((set, get) => ({
	models: [],
	loaded: false,

	async loadModels() {
		const models = await storage.listModels()
		set({ models, loaded: true })
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
}))
