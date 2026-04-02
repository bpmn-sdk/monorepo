export interface ProcessDefinition {
	processDefinitionKey: string
	name: string
	processDefinitionId: string
	bpmnProcessId?: string
	version: number
	tenantId?: string
	deploymentTime?: string
}

export interface ProcessInstance {
	processInstanceKey: string
	processDefinitionId: string
	processDefinitionKey?: string
	state: "ACTIVE" | "COMPLETED" | "CANCELED" | "TERMINATED"
	startDate?: string
	endDate?: string
}

export interface Incident {
	incidentKey: string
	processDefinitionId: string
	processDefinitionKey?: string
	processInstanceKey: string
	elementId: string
	errorType: string
	errorMessage: string
	creationTime?: string
	state?: string
}

export interface UserTask {
	userTaskKey: string
	name: string
	assignee?: string
	candidateGroups?: string[]
	dueDate?: string
	priority?: number
	processInstanceKey?: string
	processDefinitionKey?: string
}

export interface DecisionDefinition {
	decisionDefinitionKey: string
	name: string
	decisionDefinitionId: string
	version: number
	tenantId?: string
}

export interface Job {
	jobKey: string
	type: string
	state: string
	processInstanceKey?: string
}

export interface DashboardStats {
	runningInstances: number
	activeIncidents: number
	pendingTasks: number
	deployedDefinitions: number
	activeJobs: number
}

export interface Variable {
	name: string
	value: unknown
	type?: string
}

export interface ElementInstance {
	elementInstanceKey: string
	processInstanceKey: string
	processDefinitionKey: string
	elementId: string
	elementType: string
	state: string
}

export interface RunHistoryStep {
	id: string
	runId: string
	elementId: string
	jobType: string
	startedAt: string
	endedAt: string | null
	durationMs: number | null
	state: "active" | "completed" | "failed"
	inputs: string // JSON string
	outputs: string // JSON string
	errorMessage: string | null
}

export interface RunHistoryRun {
	id: string
	processInstanceKey: string
	processId: string | null
	startedAt: string
	endedAt: string | null
	state: "active" | "completed" | "failed"
	variablesSnapshot: string // JSON string
	stepCount?: number
	failedSteps?: number
	steps?: RunHistoryStep[]
}

export interface RunHistoryList {
	items: RunHistoryRun[]
	total: number
	limit: number
	offset: number
}

export interface PageResponse<T> {
	items: T[]
	page?: { totalItems: number }
}

export interface Profile {
	name: string
	active?: boolean
	apiType?: string
	baseUrl?: string | null
	authType?: string
	description?: string
	tags?: string[]
}
