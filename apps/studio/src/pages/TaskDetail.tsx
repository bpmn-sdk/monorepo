import { createUserTaskWidget } from "@bpmnkit/user-tasks"
import type { UserTaskWidgetApi } from "@bpmnkit/user-tasks"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronLeft } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { Link, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import { keys } from "../api/keys.js"
import { useUserTask } from "../api/queries.js"
import { useThemeStore } from "../stores/theme.js"

export function TaskDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: task, isLoading, isError } = useUserTask(key)
	const widgetContainerRef = useRef<HTMLDivElement>(null)
	const widgetRef = useRef<UserTaskWidgetApi | null>(null)
	const qc = useQueryClient()
	const { theme } = useThemeStore()

	// Mount / update widget when task data arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: widget is created once per task load; key/qc/theme are stable
	useEffect(() => {
		const container = widgetContainerRef.current
		if (!container || !task) return

		// If widget already exists, update it
		if (widgetRef.current) {
			widgetRef.current.setTask(task)
			return
		}

		widgetRef.current = createUserTaskWidget({
			container,
			task,
			proxyUrl: getProxyUrl(),
			profile: getActiveProfile() ?? undefined,
			theme,
			onComplete: () => {
				void qc.invalidateQueries({ queryKey: ["tasks"] })
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
			onClaim: () => {
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
			onUnclaim: () => {
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
		})

		return () => {
			widgetRef.current?.destroy()
			widgetRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [task])

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<div className="text-danger text-lg">Task not found.</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface">
				<Link href="/tasks" className="text-muted hover:text-fg" aria-label="Back to tasks">
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Tasks</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-medium text-fg">
					{isLoading ? "Loading..." : task?.name || `Task ${key}`}
				</span>
				{task?.processInstanceKey && (
					<div className="ml-auto">
						<Link
							href={`/instances/${task.processInstanceKey}`}
							className="text-xs text-accent hover:underline"
						>
							View instance →
						</Link>
					</div>
				)}
			</div>

			{/* Widget area */}
			<div className="flex-1 overflow-hidden">
				{isLoading ? (
					<div className="p-6 space-y-4">
						{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
							<div key={sk} className="h-8 animate-pulse rounded bg-surface-2" />
						))}
					</div>
				) : (
					<div ref={widgetContainerRef} className="h-full" />
				)}
			</div>
		</div>
	)
}
