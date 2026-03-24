import { InstancesStore, createInstanceDetailView } from "@bpmnkit/operate"
import { useEffect, useRef } from "preact/hooks"
import { useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"

type OperateView = ReturnType<typeof createInstanceDetailView>

export function InstanceDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<InstancesStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new InstancesStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createInstanceDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				interval: 5000,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
				onOpenInEditor: (_xml: string, name: string) => {
					const models = useModelsStore.getState().models
					const existing = models.find((m) => m.name === name)
					if (existing) setLocation(`/models/${existing.id}`)
				},
			},
			() => setLocation("/instances"),
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
