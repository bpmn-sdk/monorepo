export interface ModelFile {
	id: string
	name: string
	type: "bpmn" | "dmn" | "form"
	content: string
	processDefinitionId?: string
	createdAt: number
	updatedAt: number
	tags?: string[]
}

export interface StorageAdapter {
	listModels(): Promise<ModelFile[]>
	getModel(id: string): Promise<ModelFile | null>
	saveModel(model: Omit<ModelFile, "updatedAt">): Promise<ModelFile>
	deleteModel(id: string): Promise<void>
	getPreference<T>(key: string, fallback: T): Promise<T>
	setPreference<T>(key: string, value: T): Promise<void>
}
