import { AlertTriangle, ExternalLink } from "lucide-react"
import { useState } from "preact/hooks"
import { Link } from "wouter"
import { useDefinitions } from "../api/queries.js"
import { Input } from "../components/ui/input.js"
import { useModelsStore } from "../stores/models.js"

export function Definitions() {
	const [search, setSearch] = useState("")
	const { data, isLoading, isError } = useDefinitions()
	const { models } = useModelsStore()

	const filtered = data?.items.filter(
		(d) =>
			!search ||
			d.name?.toLowerCase().includes(search.toLowerCase()) ||
			d.processDefinitionId?.toLowerCase().includes(search.toLowerCase()),
	)

	function findLocalModel(processDefinitionId: string) {
		return models.find((m) => m.processDefinitionId === processDefinitionId)
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Could not load definitions. Is the proxy running?</p>
			</div>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-xl font-semibold text-fg">Definitions</h1>
			</div>

			<div className="mb-4">
				<Input
					placeholder="Search by name or process ID..."
					value={search}
					onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
					className="max-w-80"
					aria-label="Search definitions"
				/>
			</div>

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
							<th className="px-4 py-3 font-medium">Name</th>
							<th className="px-4 py-3 font-medium">Process ID</th>
							<th className="px-4 py-3 font-medium">Version</th>
							<th className="px-4 py-3 font-medium">Tenant</th>
							<th className="px-4 py-3 font-medium">Deployed</th>
							<th className="px-4 py-3 font-medium sr-only">Actions</th>
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
						{filtered?.map((def) => {
							const localModel = findLocalModel(def.processDefinitionId)
							return (
								<tr key={def.key} className="border-b border-border/50 hover:bg-surface-2">
									<td className="px-4 py-3">
										<Link
											href={`/definitions/${def.key}`}
											className="font-medium text-fg hover:text-accent"
										>
											{def.name || def.processDefinitionId}
										</Link>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-muted">
										{def.processDefinitionId}
									</td>
									<td className="px-4 py-3 text-muted">v{def.version}</td>
									<td className="px-4 py-3 text-muted">{def.tenantId ?? "—"}</td>
									<td className="px-4 py-3 text-muted">
										{def.deploymentTime ? new Date(def.deploymentTime).toLocaleDateString() : "—"}
									</td>
									<td className="px-4 py-3">
										{localModel && (
											<Link
												href={`/models/${localModel.id}`}
												className="flex items-center gap-1 text-xs text-accent hover:underline"
											>
												<ExternalLink size={12} />
												Open local
											</Link>
										)}
									</td>
								</tr>
							)
						})}
						{!isLoading && filtered?.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
									No definitions found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
