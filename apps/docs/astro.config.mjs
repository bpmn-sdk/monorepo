import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [
		starlight({
			title: "BPMN SDK",
			description:
				"TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams programmatically.",
			favicon: "/favicon.svg",
			social: {
				github: "https://github.com/bpmn-sdk/monorepo",
			},
			editLink: {
				baseUrl: "https://github.com/bpmn-sdk/monorepo/edit/main/apps/docs/src/content/docs/",
			},
			sidebar: [
				{
					label: "Getting Started",
					autogenerate: { directory: "getting-started" },
				},
				{
					label: "Guides",
					autogenerate: { directory: "guides" },
				},
				{
					label: "Packages",
					autogenerate: { directory: "packages" },
				},
				{
					label: "CLI",
					autogenerate: { directory: "cli" },
				},
			],
			customCss: ["./src/styles/custom.css"],
			head: [
				{
					tag: "link",
					attrs: {
						rel: "icon",
						href: "/favicon.svg",
						type: "image/svg+xml",
					},
				},
			],
		}),
	],
});
