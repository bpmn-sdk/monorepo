import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { proxyDelete, proxyFetch, proxyFetchText, proxyPost, proxyPostMultipart } from "./client.js"
import { keys } from "./keys.js"
import type {
	DashboardStats,
	DecisionDefinition,
	Incident,
	Job,
	PageResponse,
	ProcessDefinition,
	ProcessInstance,
	Profile,
	UserTask,
	Variable,
} from "./types.js"

// ── Definitions ────────────────────────────────────────────────────────────────

export function useDefinitions(filter?: object) {
	return useQuery({
		queryKey: keys.definitions(filter),
		queryFn: () =>
			proxyPost<PageResponse<ProcessDefinition>>("/api/process-definitions/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "version", order: "DESC" }],
			}),
		staleTime: 30_000,
	})
}

export function useDefinition(key: string) {
	return useQuery({
		queryKey: keys.definition(key),
		queryFn: () => proxyFetch<ProcessDefinition>(`/api/process-definitions/${key}`),
		enabled: !!key,
		staleTime: 60_000,
	})
}

export function useDefinitionXml(key: string) {
	return useQuery({
		queryKey: keys.definitionXml(key),
		queryFn: () => proxyFetchText(`/api/process-definitions/${key}/xml`),
		enabled: !!key,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 30 * 60_000,
	})
}

// ── Instances ──────────────────────────────────────────────────────────────────

export function useInstances(filter?: object) {
	return useQuery({
		queryKey: keys.instances(filter),
		queryFn: () =>
			proxyPost<PageResponse<ProcessInstance>>("/api/process-instances/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "startDate", order: "DESC" }],
			}),
		staleTime: 10_000,
		refetchInterval: 15_000,
	})
}

export function useInstance(key: string) {
	return useQuery({
		queryKey: keys.instance(key),
		queryFn: () => proxyFetch<ProcessInstance>(`/api/process-instances/${key}`),
		enabled: !!key,
		staleTime: 15_000,
	})
}

export function useInstanceVariables(key: string) {
	return useQuery({
		queryKey: keys.instanceVariables(key),
		queryFn: () =>
			proxyPost<PageResponse<Variable>>("/api/variables/search", {
				filter: { processInstanceKey: key },
			}),
		enabled: !!key,
		staleTime: 15_000,
	})
}

// ── Incidents ──────────────────────────────────────────────────────────────────

export function useIncidents(filter?: object) {
	return useQuery({
		queryKey: keys.incidents(filter),
		queryFn: () =>
			proxyPost<PageResponse<Incident>>("/api/incidents/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
				sort: [{ field: "creationTime", order: "DESC" }],
			}),
		staleTime: 10_000,
		refetchInterval: 15_000,
	})
}

export function useIncident(key: string) {
	return useQuery({
		queryKey: keys.incident(key),
		queryFn: () => proxyFetch<Incident>(`/api/incidents/${key}`),
		enabled: !!key,
		staleTime: 15_000,
	})
}

// ── User Tasks ─────────────────────────────────────────────────────────────────

export function useUserTasks(filter?: object) {
	return useQuery({
		queryKey: keys.tasks(filter),
		queryFn: () =>
			proxyPost<PageResponse<UserTask>>("/api/user-tasks/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		staleTime: 30_000,
	})
}

export function useUserTask(key: string) {
	return useQuery({
		queryKey: keys.task(key),
		queryFn: () => proxyFetch<UserTask>(`/api/user-tasks/${key}`),
		enabled: !!key,
		staleTime: 20_000,
	})
}

// ── Decisions ──────────────────────────────────────────────────────────────────

export function useDecisions(filter?: object) {
	return useQuery({
		queryKey: keys.decisions(filter),
		queryFn: () =>
			proxyPost<PageResponse<DecisionDefinition>>("/api/decision-definitions/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		staleTime: 60_000,
	})
}

export function useDecision(key: string) {
	return useQuery({
		queryKey: keys.decision(key),
		queryFn: () => proxyFetch<DecisionDefinition>(`/api/decision-definitions/${key}`),
		enabled: !!key,
		staleTime: 60_000,
	})
}

// ── Jobs ───────────────────────────────────────────────────────────────────────

export function useJobs(filter?: object) {
	return useQuery({
		queryKey: keys.jobs(filter),
		queryFn: () =>
			proxyPost<PageResponse<Job>>("/api/jobs/search", {
				filter: filter ?? {},
				page: { from: 0, limit: 50 },
			}),
		staleTime: 10_000,
	})
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function useDashboardStats() {
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
					filter: { state: "ACTIVATABLE" },
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
		staleTime: 15_000,
		refetchInterval: 15_000,
	})
}

// ── Profiles ───────────────────────────────────────────────────────────────────

export function useProfiles() {
	return useQuery({
		queryKey: keys.profiles(),
		queryFn: () => proxyFetch<Profile[]>("/profiles"),
		staleTime: 60_000,
	})
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useDeployProcess() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: ({ xml, fileName }: { xml: string; fileName: string }) => {
			const form = new FormData()
			form.append("resources", new Blob([xml], { type: "application/xml" }), fileName)
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
