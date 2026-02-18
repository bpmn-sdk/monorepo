# Copilot Instructions

<!-- Part 1 & 2: Portable across repos. Do NOT add repo-specific rules here. -->
<!-- Repo-specific instructions go in .github/instructions/repo.instructions.md -->

## Part 1 — Behavioral Guidelines

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Part 2 — General Coding Quality

### Code Correctness

- Zero compiler/type errors. Always.
- Zero linting warnings. Always.
- All existing tests must pass after your changes.
- If you change behavior, update or add tests to cover it.

### Formatting & Linting

- Run the project's formatter and linter before considering any task complete.
- Never submit code that fails formatting or linting checks.
- Match the project's existing formatting configuration — do not override it.

### Testing

- Write tests for new functionality.
- Bug fixes must include a regression test.
- Don't delete or skip existing tests unless explicitly asked.
- Tests must be deterministic — no flaky assertions, no timing dependencies.

### Error Handling

- Handle errors at the appropriate level — don't swallow them silently.
- Provide actionable error messages that help debugging.
- Fail fast on invalid input — don't let bad data propagate.

### Security

- Never commit secrets, tokens, or credentials.
- Validate and sanitize all external input.
- Use parameterized queries for database access.
- Prefer established security libraries over hand-rolled solutions.

### Performance

- Consider performance implications of your changes.
- Avoid unnecessary allocations, copies, or iterations.
- Don't optimize prematurely — but don't write obviously slow code either.

### Documentation

- Update documentation when your changes affect public APIs or user-facing behavior.
- Code comments explain *why*, not *what*. The code itself should explain *what*.
- Don't add comments that merely restate the code.

### Pre-Completion Checklist

Before finishing any task, verify:
1. The project builds with zero warnings and zero errors.
2. Formatting and linting pass.
3. Type checking passes with zero errors.
4. All tests pass.
