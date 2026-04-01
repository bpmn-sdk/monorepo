import { render } from "preact"
import { App } from "./app.js"
import "./styles/globals.css"
import { useClusterStore } from "./stores/cluster.js"
import { useModelsStore } from "./stores/models.js"
import { useProjectsStore } from "./stores/projects.js"
import { useThemeStore } from "./stores/theme.js"

// Initialize theme before render to avoid flash
useThemeStore.getState().init()

// Initialize cluster store (loads profiles)
void useClusterStore.getState().loadProfiles()

// Initialize project store, restore active project adapter, then load models
useProjectsStore
	.getState()
	.load()
	.then(() => {
		const { activeProjectId, projects } = useProjectsStore.getState()
		const { proxyUrl } = useClusterStore.getState()
		if (activeProjectId) {
			// Re-apply the adapter for the persisted active project
			useProjectsStore.getState().setActiveProject(activeProjectId, proxyUrl)
		} else {
			// Default: load from IndexedDB
			void useModelsStore.getState().loadModels()
		}
	})
	.catch(() => {
		// Fallback to IndexedDB if project store fails to load
		void useModelsStore.getState().loadModels()
	})

const rootEl = document.getElementById("root")
if (!rootEl) throw new Error("Root element not found")

render(<App />, rootEl)
