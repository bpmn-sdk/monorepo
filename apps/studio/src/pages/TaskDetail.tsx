import { AlertTriangle, ChevronLeft } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useClaimTask, useCompleteTask, useUnclaimTask, useUserTask } from "../api/queries.js"
import { Badge } from "../components/ui/badge.js"
import { Button } from "../components/ui/button.js"
import { toast } from "../stores/toast.js"

export function TaskDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: task, isLoading, isError } = useUserTask(key)
	const claimMutation = useClaimTask()
	const unclaimMutation = useUnclaimTask()
	const completeMutation = useCompleteTask()
	const widgetContainerRef = useRef<HTMLDivElement>(null)

	// In a full implementation, we would mount @bpmnkit/user-tasks widget here
	// For now we show task metadata and simple action buttons

	async function handleClaim() {
		try {
			await claimMutation.mutateAsync({ taskKey: key, assignee: "studio-user" })
			toast.success("Task claimed")
		} catch {
			toast.error("Failed to claim task")
		}
	}

	async function handleUnclaim() {
		try {
			await unclaimMutation.mutateAsync(key)
			toast.success("Task unclaimed")
		} catch {
			toast.error("Failed to unclaim task")
		}
	}

	async function handleComplete() {
		try {
			await completeMutation.mutateAsync({ taskKey: key, variables: {} })
			toast.success("Task completed")
		} catch {
			toast.error("Failed to complete task")
		}
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Task not found.</p>
			</div>
		)
	}

	const isOverdue = task?.dueDate && new Date(task.dueDate) < new Date()

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
				<div className="ml-auto flex items-center gap-2">
					{task?.assignee ? (
						<Button variant="outline" size="sm" onClick={() => void handleUnclaim()}>
							Unclaim
						</Button>
					) : (
						<Button variant="outline" size="sm" onClick={() => void handleClaim()}>
							Claim
						</Button>
					)}
					<Button size="sm" onClick={() => void handleComplete()}>
						Complete
					</Button>
				</div>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Main content */}
				<div className="flex-1 overflow-y-auto p-6">
					{isLoading ? (
						<div className="space-y-4">
							{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
								<div key={sk} className="h-8 animate-pulse rounded bg-surface-2" />
							))}
						</div>
					) : task ? (
						<div className="max-w-2xl space-y-6">
							<div>
								<h1 className="text-xl font-semibold text-fg">
									{task.name || `Task ${task.userTaskKey}`}
								</h1>
								<div className="flex items-center gap-3 mt-2">
									{task.assignee ? (
										<span className="text-sm text-muted">
											Assigned to <strong className="text-fg">{task.assignee}</strong>
										</span>
									) : (
										<span className="text-sm text-muted italic">Unassigned</span>
									)}
									{task.dueDate && (
										<span className={`text-sm ${isOverdue ? "text-danger" : "text-muted"}`}>
											Due: {new Date(task.dueDate).toLocaleDateString()}
											{isOverdue && " (overdue)"}
										</span>
									)}
									{task.priority !== undefined && (
										<Badge variant={(task.priority ?? 0) >= 60 ? "danger" : "muted"}>
											Priority {task.priority}
										</Badge>
									)}
								</div>
							</div>

							{/* Candidate groups */}
							{task.candidateGroups && task.candidateGroups.length > 0 && (
								<div>
									<p className="text-xs text-muted uppercase tracking-wider mb-2">
										Candidate Groups
									</p>
									<div className="flex flex-wrap gap-1">
										{task.candidateGroups.map((g) => (
											<Badge key={g}>{g}</Badge>
										))}
									</div>
								</div>
							)}

							{/* Form area */}
							<div
								ref={widgetContainerRef}
								className="rounded-lg border border-border bg-surface p-4 min-h-48"
							>
								<p className="text-sm text-muted text-center py-8">
									Task form rendering requires the user-tasks widget.
									<br />
									<span className="text-xs">
										Connect @bpmnkit/user-tasks to render the Camunda form.
									</span>
								</p>
							</div>
						</div>
					) : null}
				</div>

				{/* Process context sidebar */}
				<div className="w-64 shrink-0 border-l border-border bg-surface overflow-y-auto p-4 space-y-4">
					<div>
						<p className="text-xs text-muted uppercase tracking-wider mb-2">Process Context</p>
						{task?.processInstanceKey && (
							<Link
								href={`/instances/${task.processInstanceKey}`}
								className="block text-sm text-accent hover:underline"
							>
								Instance {task.processInstanceKey}
							</Link>
						)}
						{task?.processDefinitionKey && (
							<Link
								href={`/definitions/${task.processDefinitionKey}`}
								className="block text-sm text-accent hover:underline mt-1"
							>
								View definition →
							</Link>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
