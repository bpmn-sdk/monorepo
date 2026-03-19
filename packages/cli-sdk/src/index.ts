/**
 * @bpmnkit/cli-sdk — Plugin authoring SDK for the casen CLI.
 *
 * Install as a devDependency in your plugin:
 * ```
 * pnpm add -D @bpmnkit/cli-sdk
 * ```
 *
 * Then export a default {@link CasenPlugin} object from your entry point:
 * ```typescript
 * import type { CasenPlugin } from "@bpmnkit/cli-sdk"
 *
 * const plugin: CasenPlugin = {
 *   id: "com.example.my-plugin",
 *   name: "My Plugin",
 *   version: "0.1.0",
 *   groups: [myCommandGroup],
 * }
 * export default plugin
 * ```
 *
 * @packageDocumentation
 */

// ── Output ────────────────────────────────────────────────────────────────────

export type OutputFormat = "table" | "json" | "yaml"

/** Column definition for table output. */
export interface ColumnDef {
	/** Dot-path into the row object, e.g. `"processInstanceKey"` */
	key: string
	/** Column header text */
	header: string
	/** Hard truncation to this many chars (0 = no limit) */
	maxWidth?: number
	/** Optional value transformer applied before display */
	transform?: (value: unknown) => string
}

/**
 * The single output seam passed to every command's `run()` function.
 * Use these methods instead of writing to stdout directly so output
 * respects the active `--output` format (table / json / yaml).
 */
export interface OutputWriter {
	readonly format: OutputFormat
	readonly isInteractive: boolean
	/** Render a list result. Automatically unwraps `{ items: [...] }` envelopes. */
	printList(data: unknown, columns: ColumnDef[]): void
	/** Render a single object as labelled key-value pairs. */
	printItem(data: unknown): void
	/** Render raw data in the active format. */
	print(data: unknown): void
	/** Print a success line — `✓ message` */
	ok(msg: string): void
	/** Print an informational line — `→ message` */
	info(msg: string): void
}

// ── Commands ──────────────────────────────────────────────────────────────────

export interface FlagSpec {
	name: string
	short?: string
	description: string
	type: "string" | "boolean" | "number"
	default?: string | boolean | number
	required?: boolean
	/** Display placeholder in help, e.g. `"JSON"` or `"KEY"` */
	placeholder?: string
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
	/** Value is a JSON object; TUI opens a structured key-value editor. */
	json?: boolean
	/** Preset values for number fields; TUI cycles through them with ↑↓. */
	presets?: number[]
}

export interface ArgSpec {
	name: string
	description: string
	required?: boolean
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
	/** Value is a JSON object; TUI opens a key-value editor. */
	json?: boolean
}

export interface Example {
	description: string
	command: string
}

export type ParsedFlags = Record<string, string | boolean | number>

/**
 * Context passed to every command's `run()` function.
 *
 * - `positional` — arguments after the group and command tokens
 * - `flags` — parsed flag values keyed by flag name
 * - `output` — rendering interface (respects `--output` format)
 * - `getClient()` — lazily creates a Camunda REST API client from the active profile
 * - `getAdminClient()` — lazily creates a Camunda Admin API client
 */
export interface RunContext {
	positional: string[]
	flags: ParsedFlags
	output: OutputWriter
	/** Returns a Camunda C8 REST client. Cast to `CamundaClient` from `@bpmnkit/api` if needed. */
	getClient(): Promise<unknown>
	/** Returns a Camunda Admin API client. Cast to `AdminApiClient` from `@bpmnkit/api` if needed. */
	getAdminClient(): Promise<unknown>
}

/** A single executable command within a group. */
export interface Command {
	name: string
	aliases?: string[]
	description: string
	args?: ArgSpec[]
	flags?: FlagSpec[]
	examples?: Example[]
	run(ctx: RunContext): Promise<void>
}

/**
 * A group of related commands — maps to one top-level `casen <group>` token.
 * The `name` must be unique across all installed plugins and the core CLI.
 */
export interface CommandGroup {
	/** kebab-case name, e.g. `"my-integration"` */
	name: string
	aliases?: string[]
	description: string
	commands: Command[]
}

// ── Plugin contract ───────────────────────────────────────────────────────────

/**
 * The contract every casen plugin must fulfill.
 *
 * Export an object conforming to this interface as the **default export**
 * from your plugin's compiled entry point (`dist/index.js`).
 *
 * @example
 * ```typescript
 * import type { CasenPlugin } from "@bpmnkit/cli-sdk"
 *
 * const plugin: CasenPlugin = {
 *   id: "com.acme.casen-deploy",
 *   name: "Deploy",
 *   version: "1.0.0",
 *   groups: [deployGroup],
 * }
 * export default plugin
 * ```
 */
export interface CasenPlugin {
	/** Unique reverse-domain identifier, e.g. `"com.acme.casen-deploy"` */
	id: string
	/** Human-readable name shown in `casen plugin list` */
	name: string
	version: string
	/** One or more top-level command groups added to the CLI */
	groups: CommandGroup[]
}
