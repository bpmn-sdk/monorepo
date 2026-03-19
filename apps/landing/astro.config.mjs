import { defineConfig } from "astro/config"

export default defineConfig({
	site: "https://bpmnkit.com",
	build: {
		format: "file",
	},
	devToolbar: {
		enabled: false,
	},
})
