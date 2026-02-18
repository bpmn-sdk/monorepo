# designer Summary

**Timestamp:** 2026-02-18T15:16:59.414Z

Design specification created. Key points:

**This is a pure SDK library with no visual UI** — the spec covers Developer Experience (DX) as the "UX."

1. **Component hierarchy**: 3 domains (BPMN/DMN/Form) × 4 modules each (model/parser/serializer/builder) + shared XML layer + Sugiyama layout engine. Three entry points: `Bpmn`, `Dmn`, `Form`.

2. **Interaction flows**: 6 developer journeys documented — linear process creation, gateway branching with `branch()`/`connectTo()`, roundtrip parse→export, DMN tables, form creation, and REST connector sugar.

3. **States**: Builder lifecycle (Initial → Building → Complete) with 6 fail-fast error conditions (duplicate IDs, invalid connectTo, malformed XML/JSON, missing required fields, layout overlap violations).

4. **Layout**: Sugiyama algorithm with fixed sizes (events 36×36, tasks 100×80, gateways 50×50), ≥80px H / ≥60px V spacing, orthogonal edge routing, nested sub-process layout passes, and overlap assertions as hard post-conditions.

5. **Accessibility (DX)**: IntelliSense-first JSDoc, self-documenting names, progressive complexity (simple flows = 3 calls), compile-time type safety via discriminated unions, and actionable error messages that name the element and process.

Full spec saved to session artifacts.
