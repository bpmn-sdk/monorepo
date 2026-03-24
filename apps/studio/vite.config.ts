import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [preact(), tailwindcss()],
	server: { port: 5174 },
	build: {
		outDir: "dist",
		emptyOutDir: true,
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-preact": ["preact", "preact/hooks", "preact/compat"],
					"vendor-query": ["@tanstack/react-query"],
					"vendor-ui": [
						"@radix-ui/react-dialog",
						"@radix-ui/react-dropdown-menu",
						"@radix-ui/react-tooltip",
						"@radix-ui/react-tabs",
						"@radix-ui/react-separator",
						"@radix-ui/react-slot",
						"@radix-ui/react-popover",
					],
					"vendor-bpmnkit-core": ["@bpmnkit/core"],
				},
			},
		},
	},
})
