import { AlertTriangle } from "lucide-react"
import { useState } from "preact/hooks"
import { Link } from "wouter"
import { useIncidents } from "../api/queries.js"
import { Input } from "../components/ui/input.js"

export function Incidents() {
	const [search, setSearch] = useState("")
	const { data, isLoading, isError } = useIncidents()

	const filtered = data?.items.filter(
		(i) =>
			!search ||
			i.errorType?.toLowerCase().includes(search.toLowerCase()) ||
			i.errorMessage?.toLowerCase().includes(search.toLowerCase()) ||
			i.processDefinitionId?.toLowerCase().includes(search.toLowerCase()),
	)

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Could not load incidents.</p>
			</div>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-semibold text-fg">Incidents</h1>
					{!isLoading && (
						<p className="text-xs text-muted mt-0.5">
							{filtered?.length ?? 0} incident{(filtered?.length ?? 0) !== 1 ? "s" : ""}
						</p>
					)}
				</div>
			</div>

			<div className="mb-4">
				<Input
					placeholder="Search by error type or message..."
					value={search}
					onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
					className="max-w-80"
					aria-label="Search incidents"
				/>
			</div>

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
							<th className="px-4 py-3 font-medium">Error Type</th>
							<th className="px-4 py-3 font-medium">Message</th>
							<th className="px-4 py-3 font-medium">Element</th>
							<th className="px-4 py-3 font-medium">Process ID</th>
							<th className="px-4 py-3 font-medium">Instance</th>
							<th className="px-4 py-3 font-medium">Age</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							(["s0", "s1", "s2", "s3", "s4"] as const).map((sk) => (
								<tr key={sk} className="border-b border-border/50">
									{(["a", "b", "c", "d", "e", "f"] as const).map((col) => (
										<td key={col} className="px-4 py-3">
											<div className="h-4 animate-pulse rounded bg-surface-2" />
										</td>
									))}
								</tr>
							))}
						{filtered?.map((inc) => (
							<tr
								key={inc.incidentKey}
								className="border-b border-border/50 hover:bg-surface-2 transition-colors duration-100"
							>
								<td className="px-4 py-3">
									<Link
										href={`/incidents/${inc.incidentKey}`}
										className="text-danger hover:underline text-xs font-mono"
									>
										{inc.errorType}
									</Link>
								</td>
								<td className="px-4 py-3 text-muted text-xs max-w-xs truncate">
									{inc.errorMessage.slice(0, 80)}
								</td>
								<td className="px-4 py-3 text-muted text-xs font-mono">{inc.elementId}</td>
								<td className="px-4 py-3 text-muted text-xs font-mono">
									{inc.processDefinitionId}
								</td>
								<td className="px-4 py-3">
									<Link
										href={`/instances/${inc.processInstanceKey}`}
										className="text-xs text-accent hover:underline font-mono"
									>
										{inc.processInstanceKey}
									</Link>
								</td>
								<td className="px-4 py-3 text-muted text-xs">
									{inc.creationTime ? new Date(inc.creationTime).toLocaleDateString() : "—"}
								</td>
							</tr>
						))}
						{!isLoading && filtered?.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
									No incidents found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
