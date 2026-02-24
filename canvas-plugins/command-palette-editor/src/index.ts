/**
 * @bpmn-sdk/canvas-plugin-command-palette-editor — editor extension for the
 * command palette plugin. Adds one command per BPMN element type.
 *
 * Must be used together with `@bpmn-sdk/canvas-plugin-command-palette`.
 *
 * ## Usage
 * ```typescript
 * import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
 * import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
 *
 * let editorRef: BpmnEditor | null = null;
 * const palette = createCommandPalettePlugin({ ... });
 * const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
 *   editorRef?.setTool(tool);
 * });
 * const editor = new BpmnEditor({ container, xml, plugins: [palette, paletteEditor] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import type { CommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";

// ── Element catalogue ─────────────────────────────────────────────────────────

const ELEMENT_COMMANDS: Array<{ type: string; title: string; description: string }> = [
	// Events
	{ type: "startEvent", title: "Add Start Event", description: "Events: circle (thin border)" },
	{ type: "endEvent", title: "Add End Event", description: "Events: circle (thick border)" },
	// Activities
	{ type: "serviceTask", title: "Add Service Task", description: "Activities: automated task" },
	{ type: "userTask", title: "Add User Task", description: "Activities: human task" },
	{ type: "scriptTask", title: "Add Script Task", description: "Activities: script execution" },
	{ type: "sendTask", title: "Add Send Task", description: "Activities: sends a message" },
	{ type: "receiveTask", title: "Add Receive Task", description: "Activities: awaits a message" },
	{
		type: "businessRuleTask",
		title: "Add Business Rule Task",
		description: "Activities: rule engine evaluation",
	},
	// Gateways
	{
		type: "exclusiveGateway",
		title: "Add Exclusive Gateway",
		description: "Gateways: XOR — one path taken",
	},
	{
		type: "parallelGateway",
		title: "Add Parallel Gateway",
		description: "Gateways: AND — all paths taken",
	},
	{
		type: "inclusiveGateway",
		title: "Add Inclusive Gateway",
		description: "Gateways: OR — one or more paths taken",
	},
	{
		type: "eventBasedGateway",
		title: "Add Event-based Gateway",
		description: "Gateways: route based on event",
	},
];

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the editor command palette extension plugin.
 *
 * @param palette - The base command palette plugin returned by
 *   `createCommandPalettePlugin`. Commands are registered into it.
 * @param setTool - Callback that activates an element creation tool on the
 *   editor (e.g. `editor.setTool`). May reference the editor lazily — it is
 *   only called when the user executes a command, well after construction.
 */
export function createCommandPaletteEditorPlugin(
	palette: CommandPalettePlugin,
	setTool: (tool: string) => void,
): CanvasPlugin {
	let _deregister: (() => void) | null = null;

	return {
		name: "command-palette-editor",

		install(_api) {
			_deregister = palette.addCommands(
				ELEMENT_COMMANDS.map((cmd) => ({
					id: `create:${cmd.type}`,
					title: cmd.title,
					description: cmd.description,
					action() {
						setTool(`create:${cmd.type}`);
					},
				})),
			);
		},

		uninstall() {
			_deregister?.();
			_deregister = null;
		},
	};
}
