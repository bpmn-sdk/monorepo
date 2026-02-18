---
applyTo: "**"
---

# Repo-Specific Instructions

<!-- Part 3: Everything below is specific to THIS repository. -->
<!-- Parts 1 & 2 (behavioral + coding quality) live in .github/copilot-instructions.md -->

## Tech Stack

- **Architecture:** Turborepo monorepo
- **Language:** TypeScript (strict mode) — latest stable
- **Runtime:** Node.js — latest LTS
- **Package Manager:** pnpm (workspaces)
- **Build System:** Turborepo
- **Testing:** Vitest
- **Linting & Formatting:** Biome
- **Frontend:** React with Carbon Design System
- **State Management:** Zustand (preferred over raw React hooks for all state management)
- **Dependencies:** Latest versions only; prefer mature, well-maintained packages
- **Dependency Policy:** Only add external packages when functionality cannot be reasonably implemented in-repo

## Project Structure

Follow Turborepo best practices:

```
apps/
  backend/         # Node.js backend (ESM)
  frontend/        # React frontend (Carbon Design System)
packages/
  shared/          # Shared types, utilities, constants
  ui/              # Shared UI components (if needed)
  config/          # Shared configuration (TypeScript, Biome, etc.)
turbo.json         # Turborepo pipeline configuration
package.json       # Root package.json (all devDependencies here)
biome.json         # Biome configuration
```

## Dependency Management

- **All `devDependencies` must be declared in the root `package.json`** — never in individual app or package `package.json` files
- Runtime `dependencies` belong in the respective app/package `package.json`

## Build & Check Commands

- Build: `pnpm turbo build`
- Lint & Format: `pnpm turbo check` or `pnpm biome check .`
- Typecheck: `pnpm turbo typecheck` or `pnpm tsc --noEmit`
- Test: `pnpm turbo test`

## Backend Guidelines

- **ESM only** — use `"type": "module"` in `package.json`, use `.js` extensions in imports
- Follow latest Node.js best practices and recommendations
- Use modern APIs: `fetch`, `node:` protocol imports, top-level `await`
- Prefer native Node.js APIs over third-party packages where possible
- Structure code for testability and separation of concerns

## Frontend Guidelines

- **React** with **Carbon Design System** (`@carbon/react`) for all UI components
- **Zustand** for state management — centralize state in stores, avoid scattering `useState`/`useEffect` across components
- Only use raw React hooks (`useState`, `useEffect`, `useRef`, etc.) when Zustand or Carbon components do not cover the use case
- Prefer Carbon's built-in component patterns and design tokens over custom styling
- Optimize for render performance: minimize re-renders, use selectors in Zustand stores

## TypeScript Practices

- Prefer compile-time (type-level) guarantees over runtime checks
- Write idiomatic TypeScript: use discriminated unions, template literals, and branded types where appropriate
- TypeScript strict mode — zero type errors across the entire monorepo
- Biome — zero warnings, zero errors

## Documentation Requirements

| File                   | Purpose                                            | Update Frequency           |
| ---------------------- | -------------------------------------------------- | -------------------------- |
| `README.md`            | Brief intro, motivation, prerequisites, quickstart | On significant changes     |
| `doc/progress.md`      | Historical changelog                               | **Every change**           |
| `doc/features.md`      | High-level feature list with timestamps            | When features are added    |
| `doc/documentation.md` | Detailed CLI usage documentation                   | When features change       |
| `doc/roadmap.md`       | Implementation roadmap with action items           | Check items when completed |

### Roadmap Tracking

When completing action items from `doc/roadmap.md`:

- Mark completed items with `[x]` instead of `[ ]`
- Keep the roadmap up-to-date as features are implemented
