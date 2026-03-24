import { render } from "preact"
import { App } from "./app.js"
import "./styles/globals.css"
import { useClusterStore } from "./stores/cluster.js"
import { useModelsStore } from "./stores/models.js"
import { useThemeStore } from "./stores/theme.js"

// Initialize theme before render to avoid flash
useThemeStore.getState().init()

// Initialize cluster store (loads profiles)
void useClusterStore.getState().loadProfiles()

// Initialize models store (loads from IndexedDB)
void useModelsStore.getState().loadModels()

const rootEl = document.getElementById("root")
if (!rootEl) throw new Error("Root element not found")

render(<App />, rootEl)
