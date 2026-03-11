/**
 * Framework-agnostic relation graph between API operations.
 *
 * A Relation declares that a field produced by one operation (e.g. the
 * "processDefinitionKey" column of the process-definition list) can be
 * used as a parameter for another operation (e.g. get-xml). Both the CLI
 * (to pre-fill command args) and the operate frontend (to suggest navigation)
 * import these types and use buildRelations() to compute the graph.
 */

/** A follow-up link from one operation's output field to another's input param. */
export interface Relation {
	/** Name of the group containing the target operation */
	groupName: string
	/** Name of the target operation/command */
	commandName: string
	/** Human-readable description of the follow-up action */
	description: string
	/** How to map source fields to target params */
	params: Array<{ field: string; param: string }>
}

/**
 * Generic descriptor for an operation in the relation graph.
 * CLI commands and operate views can both be described as RelationSources.
 */
export interface RelationSource {
	groupName: string
	commandName: string
	description: string
	/** Field names this operation produces (e.g. list column keys). */
	outputFields: string[]
	/** Parameter names this operation accepts as input (e.g. arg names). */
	inputParams: string[]
}

/**
 * Build a map of relations for all provided sources.
 * For each source with output fields, finds other sources whose input
 * params match those fields. Returns a map keyed by "groupName/commandName".
 */
export function buildRelations(sources: RelationSource[]): Map<string, Relation[]> {
	// Build index: inputParam → sources that accept it
	const paramIndex = new Map<string, RelationSource[]>()
	for (const src of sources) {
		for (const param of src.inputParams) {
			const existing = paramIndex.get(param) ?? []
			existing.push(src)
			paramIndex.set(param, existing)
		}
	}

	const result = new Map<string, Relation[]>()

	for (const src of sources) {
		if (src.outputFields.length === 0) continue

		const relations: Relation[] = []
		const seen = new Set<string>()

		for (const field of src.outputFields) {
			const targets = paramIndex.get(field) ?? []
			for (const target of targets) {
				if (target === src) continue
				const key = `${target.groupName}/${target.commandName}`
				if (seen.has(key)) continue
				seen.add(key)
				relations.push({
					groupName: target.groupName,
					commandName: target.commandName,
					description: target.description,
					params: [{ field, param: field }],
				})
			}
		}

		if (relations.length > 0) {
			result.set(`${src.groupName}/${src.commandName}`, relations)
		}
	}

	return result
}
