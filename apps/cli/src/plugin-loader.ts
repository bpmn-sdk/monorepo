import { readFile, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { CommandGroup } from "./types.js"

// ── Paths ─────────────────────────────────────────────────────────────────────

export const PLUGINS_DIR = join(homedir(), ".casen", "plugins")

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginMeta {
	/** The npm package name, e.g. "casen-deploy" or "@acme/casen-deploy" */
	package: string
	version: string
	installedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts an npm package name to a safe directory name.
 * "@acme/casen-deploy" → "acme__casen-deploy"
 */
export function sanitiseName(pkg: string): string {
	return pkg.replace(/^@/, "").replace(/\//g, "__")
}

// ── Plugin loader ─────────────────────────────────────────────────────────────

/**
 * Loads all installed plugins from `~/.casen/plugins/` and returns their
 * combined command groups. Failures are isolated — a broken plugin logs a
 * warning to stderr and is skipped; it cannot crash the CLI.
 */
export async function loadPlugins(): Promise<CommandGroup[]> {
	let entries: string[]
	try {
		entries = await readdir(PLUGINS_DIR)
	} catch {
		return []
	}

	const groups: CommandGroup[] = []

	for (const entry of entries) {
		if (entry.startsWith(".")) continue
		const pluginDir = join(PLUGINS_DIR, entry)
		try {
			// Read metadata to get the actual npm package name
			const metaText = await readFile(join(pluginDir, ".meta.json"), "utf8")
			const meta = JSON.parse(metaText) as PluginMeta
			const pkgName = meta.package

			// Resolve entry point via the plugin's own package.json
			const pkgText = await readFile(
				join(pluginDir, "node_modules", pkgName, "package.json"),
				"utf8",
			)
			const pkg = JSON.parse(pkgText) as { main?: string }
			const main = pkg.main ?? "dist/index.js"
			const entryPath = join(pluginDir, "node_modules", pkgName, main)

			// Dynamic import — use file URL for cross-platform compatibility
			const mod = (await import(pathToFileURL(entryPath).href)) as Record<string, unknown>
			const plugin = (mod.default ?? mod) as { groups?: unknown }

			if (!Array.isArray(plugin.groups)) {
				process.stderr.write(`[plugin] ${pkgName}: no groups exported, skipping\n`)
				continue
			}

			groups.push(...(plugin.groups as CommandGroup[]))
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			process.stderr.write(`[plugin] ${entry}: failed to load — ${msg}\n`)
		}
	}

	return groups
}

// ── Management helpers ────────────────────────────────────────────────────────

/**
 * Returns metadata for all installed plugins.
 * Directories without a `.meta.json` are silently ignored.
 */
export async function readInstalledPlugins(): Promise<Array<PluginMeta & { dir: string }>> {
	let entries: string[]
	try {
		entries = await readdir(PLUGINS_DIR)
	} catch {
		return []
	}

	const result: Array<PluginMeta & { dir: string }> = []

	for (const entry of entries) {
		if (entry.startsWith(".")) continue
		const dir = join(PLUGINS_DIR, entry)
		try {
			const metaText = await readFile(join(dir, ".meta.json"), "utf8")
			const meta = JSON.parse(metaText) as PluginMeta
			result.push({ ...meta, dir })
		} catch {
			// Directory without .meta.json — not a managed plugin, skip
		}
	}

	return result
}
