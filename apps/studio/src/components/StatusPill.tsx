import { Badge } from "./ui/badge.js"

interface StatusPillProps {
	state: string
}

const STATE_CONFIG: Record<
	string,
	{ label: string; variant: "success" | "muted" | "danger" | "warn" | "default" }
> = {
	ACTIVE: { label: "Active", variant: "success" },
	COMPLETED: { label: "Completed", variant: "muted" },
	INCIDENT: { label: "Incident", variant: "danger" },
	TERMINATED: { label: "Terminated", variant: "muted" },
	CANCELED: { label: "Canceled", variant: "muted" },
	FAILED: { label: "Failed", variant: "danger" },
	RESOLVED: { label: "Resolved", variant: "muted" },
	PENDING: { label: "Pending", variant: "warn" },
}

export function StatusPill({ state }: StatusPillProps) {
	const config = STATE_CONFIG[state] ?? { label: state, variant: "default" as const }
	return <Badge variant={config.variant}>{config.label}</Badge>
}
