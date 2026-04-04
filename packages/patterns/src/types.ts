/**
 * Domain process pattern types for BPMNKit AIKit.
 *
 * PatternTemplate is structurally compatible with CompactDiagram from @bpmnkit/core
 * but declared here to avoid a hard dependency.
 */

export interface PatternElement {
	id: string
	type: string
	name?: string
	jobType?: string
	eventType?: string
	formId?: string
	attachedTo?: string
	interrupting?: boolean
}

export interface PatternFlow {
	id: string
	from: string
	to: string
	name?: string
	condition?: string
}

export interface PatternProcess {
	id: string
	name?: string
	elements: PatternElement[]
	flows: PatternFlow[]
}

export interface PatternTemplate {
	id: string
	processes: PatternProcess[]
}

export interface WorkerSpec {
	/** Display name */
	name: string
	/** Zeebe job type string, e.g. "com.example:send-email:1" */
	jobType: string
	/** What this worker does */
	description: string
	/** Variable name → type description */
	inputs: Record<string, string>
	/** Variable name → type description */
	outputs: Record<string, string>
	/** Real external API options, e.g. ["Stripe", "PayPal"] */
	externalApis?: string[]
	/** True if this worker is optional / situational */
	optional?: boolean
}

export interface Pattern {
	/** Unique slug, e.g. "invoice-approval" */
	id: string
	/** Human-readable name */
	name: string
	/** One-line description */
	description: string
	/** Keywords Claude uses to match this pattern to a user request */
	keywords: string[]
	/** Domain context in Markdown: regulations, conventions, common pitfalls */
	readme: string
	/** Required/common service tasks and their specs */
	workers: WorkerSpec[]
	/** Common customizations in Markdown */
	variations: string
	/** Starting-point compact BPMN template */
	template: PatternTemplate
}
