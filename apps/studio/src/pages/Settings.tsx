import { useEffect, useState } from "preact/hooks"
import { useProfiles } from "../api/queries.js"
import { ProfileTag } from "../components/ProfileTag.js"
import { ThemePicker } from "../components/ThemePicker.js"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import { Separator } from "../components/ui/separator.js"
import { useClusterStore } from "../stores/cluster.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

export function Settings() {
	const { proxyUrl, activeProfile, setActiveProfile, setProxyUrl, loadProfiles } = useClusterStore()
	const [proxyInput, setProxyInput] = useState(proxyUrl)
	const { data: profiles, refetch } = useProfiles()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Settings" }])
	}, [setBreadcrumbs])

	function handleSaveProxy() {
		setProxyUrl(proxyInput)
		toast.success("Proxy URL saved")
		void loadProfiles()
	}

	async function handleRefreshProfiles() {
		await loadProfiles()
		await refetch()
		toast.info("Profiles refreshed")
	}

	return (
		<div className="p-6 max-w-2xl mx-auto">
			{/* Proxy URL */}
			<section className="mb-6">
				<h2 className="text-sm font-medium text-fg mb-1">Proxy Server</h2>
				<p className="text-xs text-muted mb-3">
					All Camunda API calls are routed through the proxy. Make sure it's running.
				</p>
				<div className="flex gap-2">
					<Input
						value={proxyInput}
						onInput={(e) => setProxyInput((e.target as HTMLInputElement).value)}
						placeholder="http://localhost:3033"
						aria-label="Proxy URL"
					/>
					<Button onClick={handleSaveProxy}>Save</Button>
				</div>
				<code className="mt-2 block text-xs text-muted">pnpm proxy</code>
			</section>

			<Separator className="mb-6" />

			{/* Profiles */}
			<section className="mb-6">
				<div className="flex items-center justify-between mb-3">
					<div>
						<h2 className="text-sm font-medium text-fg">Profiles</h2>
						<p className="text-xs text-muted">Camunda cluster connections</p>
					</div>
					<Button variant="outline" size="sm" onClick={() => void handleRefreshProfiles()}>
						Refresh
					</Button>
				</div>

				{!profiles || profiles.length === 0 ? (
					<p className="text-sm text-muted">
						No profiles found. Configure profiles in your proxy config file.
					</p>
				) : (
					<div className="rounded-lg border border-border bg-surface overflow-hidden">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
									<th className="px-4 py-2 font-medium">Name</th>
									<th className="px-4 py-2 font-medium">Tags</th>
									<th className="px-4 py-2 font-medium">Type</th>
									<th className="px-4 py-2 font-medium">Active</th>
								</tr>
							</thead>
							<tbody>
								{profiles.map((p) => (
									<tr key={p.name} className="border-b border-border/50 last:border-0">
										<td className="px-4 py-2.5">
											<div className="font-medium text-fg">{p.name}</div>
											{p.description && (
												<div className="text-xs text-muted mt-0.5">{p.description}</div>
											)}
										</td>
										<td className="px-4 py-2.5">
											{p.tags && p.tags.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{p.tags.map((t) => (
														<ProfileTag key={t} tag={t} />
													))}
												</div>
											) : (
												<span className="text-xs text-muted">—</span>
											)}
										</td>
										<td className="px-4 py-2.5 text-muted text-xs">{p.apiType ?? "—"}</td>
										<td className="px-4 py-2.5">
											<button
												type="button"
												onClick={() => setActiveProfile(p.name)}
												className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
													p.name === activeProfile
														? "bg-accent/20 text-accent"
														: "text-muted hover:text-fg"
												}`}
												aria-pressed={p.name === activeProfile}
											>
												{p.name === activeProfile ? "● Active" : "Set active"}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<Separator className="mb-6" />

			{/* Theme */}
			<section>
				<h2 className="text-sm font-medium text-fg mb-3">Theme</h2>
				<ThemePicker />
			</section>
		</div>
	)
}
