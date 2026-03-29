import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useClusterStore } from "../stores/cluster.js"
import { proxyDelete, proxyFetch, proxyFetchText, proxyPost, proxyPostMultipart } from "./client.js"
import { keys } from "./keys.js"
import type {
	DashboardStats,
	DecisionDefinition,
	ElementInstance,
	Incident,
	Job,
	PageResponse,
	ProcessDefinition,
	ProcessInstance,
	Profile,
	UserTask,
	Variable,
} from "./types.js"

function useProxyEnabled() {
	return useClusterStore((s) => s.status === "connected")
}

// ── Definitions ────────────────────────────────────────────────────────────────

export function useDefinitions(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.definitions(filter),
		queryFn: () =>
			proxyPost<PageResponse<ProcessDefinition>>("/api/process-definitions/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "version", order: "DESC" }],
			}),
		enabled: proxyEnabled,
		staleTime: 30_000,
	})
}

export function useDefinition(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.definition(key),
		queryFn: () => proxyFetch<ProcessDefinition>(`/api/process-definitions/${key}`),
		enabled: proxyEnabled && !!key,
		staleTime: 60_000,
	})
}

export function useDefinitionXml(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.definitionXml(key),
		queryFn: () => proxyFetchText(`/api/process-definitions/${key}/xml`),
		enabled: proxyEnabled && !!key,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 30 * 60_000,
	})
}

// ── Instances ──────────────────────────────────────────────────────────────────

export function useInstances(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.instances(filter),
		queryFn: () =>
			proxyPost<PageResponse<ProcessInstance>>("/api/process-instances/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "startDate", order: "DESC" }],
			}),
		enabled: proxyEnabled,
		staleTime: 10_000,
		refetchInterval: 15_000,
	})
}

export function useInstance(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.instance(key),
		queryFn: () => proxyFetch<ProcessInstance>(`/api/process-instances/${key}`),
		enabled: proxyEnabled && !!key,
		staleTime: 15_000,
	})
}

export function useInstanceVariables(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.instanceVariables(key),
		queryFn: () =>
			proxyPost<PageResponse<Variable>>("/api/variables/search", {
				filter: { processInstanceKey: key },
			}),
		enabled: proxyEnabled && !!key,
		staleTime: 15_000,
	})
}

export function useElementInstances(processInstanceKey: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: ["element-instances", processInstanceKey],
		queryFn: () =>
			proxyPost<PageResponse<ElementInstance>>("/api/element-instances/search", {
				filter: { processInstanceKey },
			}),
		enabled: proxyEnabled && !!processInstanceKey,
		staleTime: 10_000,
	})
}

// ── Incidents ──────────────────────────────────────────────────────────────────

export function useIncidents(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.incidents(filter),
		queryFn: () =>
			proxyPost<PageResponse<Incident>>("/api/incidents/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "creationTime", order: "DESC" }],
			}),
		enabled: proxyEnabled,
		staleTime: 10_000,
		refetchInterval: 15_000,
	})
}

export function useIncident(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.incident(key),
		queryFn: () => proxyFetch<Incident>(`/api/incidents/${key}`),
		enabled: proxyEnabled && !!key,
		staleTime: 15_000,
	})
}

// ── User Tasks ─────────────────────────────────────────────────────────────────

export function useUserTasks(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.tasks(filter),
		queryFn: () =>
			proxyPost<PageResponse<UserTask>>("/api/user-tasks/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		enabled: proxyEnabled,
		staleTime: 30_000,
	})
}

export function useUserTask(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.task(key),
		queryFn: () => proxyFetch<UserTask>(`/api/user-tasks/${key}`),
		enabled: proxyEnabled && !!key,
		staleTime: 20_000,
	})
}

// ── Decisions ──────────────────────────────────────────────────────────────────

export function useDecisions(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.decisions(filter),
		queryFn: () =>
			proxyPost<PageResponse<DecisionDefinition>>("/api/decision-definitions/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		enabled: proxyEnabled,
		staleTime: 60_000,
	})
}

export function useDecision(key: string) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.decision(key),
		queryFn: () => proxyFetch<DecisionDefinition>(`/api/decision-definitions/${key}`),
		enabled: proxyEnabled && !!key,
		staleTime: 60_000,
	})
}

// ── Jobs ───────────────────────────────────────────────────────────────────────

export function useJobs(filter?: object) {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.jobs(filter),
		queryFn: () =>
			proxyPost<PageResponse<Job>>("/api/jobs/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		enabled: proxyEnabled,
		staleTime: 10_000,
	})
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function useDashboardStats() {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.dashboard(),
		queryFn: async (): Promise<DashboardStats> => {
			const empty: PageResponse<never> = { items: [] }
			const [instances, incidents, tasks, definitions, jobs] = await Promise.all([
				proxyPost<PageResponse<ProcessInstance>>("/api/process-instances/search", {
					filter: { state: "ACTIVE" },
					page: { from: 0, limit: 1 },
				}).catch(() => empty),
				proxyPost<PageResponse<Incident>>("/api/incidents/search", {
					filter: { state: "ACTIVE" },
					page: { from: 0, limit: 1 },
				}).catch(() => empty),
				proxyPost<PageResponse<UserTask>>("/api/user-tasks/search", {
					filter: {},
					page: { from: 0, limit: 1 },
				}).catch(() => empty),
				proxyPost<PageResponse<ProcessDefinition>>("/api/process-definitions/search", {
					filter: {},
					page: { from: 0, limit: 1 },
				}).catch(() => empty),
				proxyPost<PageResponse<Job>>("/api/jobs/search", {
					filter: { state: "CREATED" },
					page: { from: 0, limit: 1 },
				}).catch(() => empty),
			])
			return {
				runningInstances: instances.page?.totalItems ?? instances.items.length,
				activeIncidents: incidents.page?.totalItems ?? incidents.items.length,
				pendingTasks: tasks.page?.totalItems ?? tasks.items.length,
				deployedDefinitions: definitions.page?.totalItems ?? definitions.items.length,
				activeJobs: jobs.page?.totalItems ?? jobs.items.length,
			}
		},
		enabled: proxyEnabled,
		staleTime: 15_000,
		refetchInterval: 15_000,
	})
}

// ── Profiles ───────────────────────────────────────────────────────────────────

export function useProfiles() {
	const proxyEnabled = useProxyEnabled()
	return useQuery({
		queryKey: keys.profiles(),
		queryFn: () => proxyFetch<Profile[]>("/profiles"),
		enabled: proxyEnabled,
		staleTime: 60_000,
	})
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateProcessInstance() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (params: {
			processDefinitionKey?: string
			bpmnProcessId?: string
			variables?: Record<string, unknown>
		}) => proxyPost<{ processInstanceKey: string }>("/api/process-instances", params),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["instances"] })
			void qc.invalidateQueries({ queryKey: ["dashboard"] })
		},
	})
}

export function useDeployProcess() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: ({
			xml,
			fileName,
			companions,
		}: {
			xml: string
			fileName: string
			/** Additional XML resources (e.g. companion DMN files) to deploy together. */
			companions?: Array<{ xml: string; fileName: string }>
		}) => {
			const form = new FormData()
			form.append("resources", new Blob([xml], { type: "application/xml" }), fileName)
			for (const c of companions ?? []) {
				form.append("resources", new Blob([c.xml], { type: "application/xml" }), c.fileName)
			}
			return proxyPostMultipart<{
				deploymentKey?: string
				processes?: Array<{
					processDefinitionKey?: string
					bpmnProcessId?: string
					version?: number
				}>
			}>("/api/deployments", form)
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["definitions"] })
		},
	})
}

export function useCancelInstance() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (key: string) => proxyDelete<void>(`/api/process-instances/${key}`),
		onSuccess: (_data, key) => {
			void qc.invalidateQueries({ queryKey: keys.instance(key) })
			void qc.invalidateQueries({ queryKey: ["instances"] })
		},
	})
}

export function useRetryIncident() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (incidentKey: string) =>
			proxyPost<void>(`/api/incidents/${incidentKey}/resolution`),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["incidents"] })
		},
	})
}

export function useClaimTask() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: ({ taskKey, assignee }: { taskKey: string; assignee: string }) =>
			proxyPost<void>(`/api/user-tasks/${taskKey}/assignment`, { assignee }),
		onSuccess: (_data, { taskKey }) => {
			void qc.invalidateQueries({ queryKey: keys.task(taskKey) })
			void qc.invalidateQueries({ queryKey: ["tasks"] })
		},
	})
}

export function useUnclaimTask() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (taskKey: string) => proxyDelete<void>(`/api/user-tasks/${taskKey}/assignment`),
		onSuccess: (_data, taskKey) => {
			void qc.invalidateQueries({ queryKey: keys.task(taskKey) })
			void qc.invalidateQueries({ queryKey: ["tasks"] })
		},
	})
}

export function useCompleteTask() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: ({
			taskKey,
			variables,
		}: {
			taskKey: string
			variables?: Record<string, unknown>
		}) => proxyPost<void>(`/api/user-tasks/${taskKey}/completion`, { variables: variables ?? {} }),
		onSuccess: (_data, { taskKey }) => {
			void qc.invalidateQueries({ queryKey: keys.task(taskKey) })
			void qc.invalidateQueries({ queryKey: ["tasks"] })
		},
	})
}
