import { defineConfig } from "vite";

export default defineConfig({
	root: ".",
	base: "/bpmn-sdk/",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
