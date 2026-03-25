import { DefinitionsStore, createDefinitionDetailView } from "@bpmnkit/operate"
import { useEffect, useRef } from "preact/hooks"
import { useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import { useDefinition } from "../api/queries.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { useUiStore } from "../stores/ui.js"

type OperateView = ReturnType<typeof createDefinitionDetailView>

export function DefinitionDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<DefinitionsStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()
	const { setBreadcrumbs } = useUiStore()
	const { data: definition } = useDefinition(key)

	useEffect(() => {
		const name = definition?.name ?? definition?.processDefinitionId ?? key
		setBreadcrumbs([{ label: "Definitions", href: "/definitions" }, { label: name }])
	}, [key, definition?.name, definition?.processDefinitionId, setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new DefinitionsStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createDefinitionDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
				onOpenInEditor: (xml: string, name: string, processDefinitionId: string | undefined) => {
					const { models, saveModel } = useModelsStore.getState()
					const existing = models.find((m) => m.name === name)
					if (existing) {
						setLocation(`/models/${existing.id}`)
					} else {
						void saveModel({
							id: crypto.randomUUID(),
							name,
							type: "bpmn",
							content: xml,
							processDefinitionId,
							createdAt: Date.now(),
						}).then((model) => setLocation(`/models/${model.id}`))
					}
				},
			},
			() => setLocation("/definitions"),
		)

		container.appendChild(view.el)
		viewRef.current = view

		return () => {
			view.destroy()
			store.destroy()
			viewRef.current = null
			storeRef.current = null
		}
	}, [key])

	useEffect(() => {
		viewRef.current?.setTheme(theme)
	}, [theme])

	return <div ref={containerRef} className="h-full" />
}
