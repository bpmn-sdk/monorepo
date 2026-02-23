import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	root: ".",
	base: "/bpmn-sdk/",
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(import.meta.dirname, "index.html"),
				editor: resolve(import.meta.dirname, "editor.html"),
			},
		},
	},
});
