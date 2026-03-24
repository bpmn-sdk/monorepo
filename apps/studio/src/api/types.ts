export interface ProcessDefinition {
	key: string
	name: string
	processDefinitionId: string
	bpmnProcessId?: string
	version: number
	tenantId?: string
	deploymentTime?: string
}

export interface ProcessInstance {
	key: string
	processDefinitionId: string
	processDefinitionKey?: string
	state: "ACTIVE" | "COMPLETED" | "CANCELED" | "TERMINATED"
	startDate?: string
	endDate?: string
}

export interface Incident {
	incidentKey: string
	processDefinitionId: string
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
	key: string
	name: string
	decisionDefinitionId: string
	version: number
	tenantId?: string
}

export interface Job {
	key: string
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

export interface PageResponse<T> {
	items: T[]
	total?: number
}

export interface Profile {
	name: string
	active?: boolean
	apiType?: string
	baseUrl?: string | null
	authType?: string
}
