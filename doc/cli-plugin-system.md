# casen CLI — Plugin System Design

## 1. Should casen Have a Plugin System?

### Survey of Popular CLI Plugin Approaches

**Binary-on-PATH model (`gh`, `git`)** — The GitHub CLI discovers any executable named `gh-<name>` on `$PATH` and exposes it as `gh <name>`. No manifest, no registry. Simple to implement and extremely flexible, but plugins are opaque shell scripts or arbitrary binaries: no type safety, no TUI integration, no profile/auth sharing.

**Package-based model (`kubectl`/krew, Heroku CLI/oclif, Azure CLI)** — Plugins are installable npm/pip packages or binary archives registered in a curated index. Heroku and Azure both use this model: `heroku plugins:install <npm-package>`. Plugins can access the host CLI's authenticated session and shared utilities. Requires a richer SDK contract but enables deep integration.

**Fixed-feature model (`stripe`, `vercel`, `railway`, `flyctl`)** — No plugin system at all. If something belongs in the CLI it gets added to core; everything else is out of scope. These CLIs target a narrow, well-defined API surface and their teams can keep up with demand.

### Verdict: Yes, a plugin system is appropriate for casen

The fixed-feature model works when a single team controls the entire surface area. casen targets Camunda 8, which is deployed by many organizations each with their own conventions, CI pipelines, and integrations. The compelling evidence:

- **Organizational diversity**: One team needs incident-to-PagerDuty routing; another needs Jira ticket creation on incident; a third needs deploy artifacts pushed to S3. No CLI core team can anticipate all of these.
- **Community opportunity**: The `gh` plugin ecosystem (100+ community plugins) demonstrates that CLI users will build integrations when the contract is clear.
- **casen's architecture is already primed**: `CommandGroup[]` is the natural extension point. `run.ts` assembles groups, passes them to `runCli` or `startTui`. Adding externally-loaded groups requires minimal structural change.
- **Profile/auth sharing**: Plugins need authenticated Zeebe/Operate clients — the real value-add over a standalone script. A proper plugin SDK makes this trivial.

The binary-on-PATH model is too weak here (no TUI integration, no profile sharing). The package-based model is the right fit.

---

## 2. Core vs. Plugin Matrix

Everything in the matrix below that should stay in core does so because all casen users need it, it relies on stable internal types, or it would be impractical to maintain as a separate package.

| Capability | Core | Plugin |
|---|---|---|
| `profile` (add / list / remove) | ✓ | |
| `processes` list/describe/start | ✓ | |
| `instances` list/describe/cancel | ✓ | |
| `incidents` list/resolve | ✓ | |
| `jobs` list/activate/complete/fail | ✓ | |
| `variables` get/set | ✓ | |
| `messages` publish | ✓ | |
| `decisions` list/evaluate | ✓ | |
| `deploy` BPMN/DMN/form | ✓ | |
| `connector` generate element templates | ✓ | |
| Deploy + Git tag + changelog | | `casen-deploy` |
| CI-mode output (JUnit XML, SARIF) | | `casen-ci` |
| Schema migration scripts | | `casen-migrate` |
| Form/template scaffolding | | `casen-templates` |
| Incident report generation (HTML/PDF) | | `casen-report` |
| Slack/PagerDuty/Jira notifications | | `casen-slack` etc. |
| Tenant/environment provisioning | | `casen-admin` |
| Custom approval workflows | | org-specific plugins |

---

## 3. Architecture

### 3.1 Plugin Contract (`CasenPlugin`)

Plugins export a single default object conforming to `CasenPlugin`. The SDK package (`@bpmnkit/cli-sdk`) re-exports everything a plugin author needs.

```typescript
// packages/cli-sdk/src/index.ts  (new package, not yet created)

export interface CasenPlugin {
  /** Unique reverse-domain identifier, e.g. "com.acme.casen-deploy" */
  id: string
  /** Human-readable name shown in `casen plugin list` */
  name: string
  version: string
  /** One or more top-level command groups added to the CLI */
  groups: CommandGroup[]
}

// Re-exports from apps/cli for plugin authors
export type { CommandGroup, Command, RunContext } from "@bpmnkit/cli-types"
```

`CommandGroup` is already defined in `apps/cli/src/types.ts`. The SDK package just re-exports it so plugin authors don't take a direct dependency on the internal app.

### 3.2 File Layout

```
~/.casen/
  config.json          # existing profiles file
  plugins/
    casen-deploy/
      package.json
      index.js         # ESM default export: CasenPlugin
    casen-ci/
      package.json
      index.js
```

Each plugin directory is a standard npm package. `casen plugin install <name>` runs `npm install --prefix ~/.casen/plugins/<name> <name>` (or accepts a local path for development).

### 3.3 Plugin Loader (`apps/cli/src/plugin-loader.ts`)

```typescript
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import type { CasenPlugin } from "@bpmnkit/cli-sdk"
import type { CommandGroup } from "./types.js"

const PLUGINS_DIR = join(homedir(), ".casen", "plugins")

export async function loadPlugins(): Promise<CommandGroup[]> {
  let entries: string[]
  try {
    entries = await readdir(PLUGINS_DIR)
  } catch {
    return [] // no plugins directory — silent
  }

  const groups: CommandGroup[] = []

  for (const entry of entries) {
    const pkgMain = join(PLUGINS_DIR, entry, "index.js")
    try {
      const mod = await import(pkgMain)
      const plugin: CasenPlugin = mod.default ?? mod
      if (!plugin?.groups) {
        console.error(`[plugin] ${entry}: no groups exported, skipping`)
        continue
      }
      groups.push(...plugin.groups)
    } catch (err) {
      console.error(`[plugin] ${entry}: failed to load — ${String(err)}`)
    }
  }

  return groups
}
```

### 3.4 Integration in `run.ts`

```typescript
// apps/cli/src/run.ts  (abbreviated)
import { loadPlugins } from "./plugin-loader.js"
import { pluginGroup } from "./commands/plugin/index.js"

export async function run(argv: string[]): Promise<void> {
  const pluginGroups = await loadPlugins()

  const allGroups: CommandGroup[] = [
    profileGroup,
    processesGroup,
    instancesGroup,
    incidentsGroup,
    jobsGroup,
    variablesGroup,
    messagesGroup,
    decisionsGroup,
    deployGroup,
    connectorGroup,
    pluginGroup,       // built-in plugin management commands
    ...pluginGroups,   // dynamically loaded
  ]

  // existing dispatch logic unchanged
  await runCli(argv, allGroups, ctx)
}
```

### 3.5 `plugin` Command Group

```
casen plugin list               # list installed plugins (name, version, id)
casen plugin install <name>     # install from npm registry
casen plugin install ./path     # install from local directory (dev mode)
casen plugin remove <name>      # uninstall
casen plugin update [name]      # update one or all plugins
casen plugin info <name>        # show metadata for an installed plugin
```

The `plugin install` subcommand shells out to `npm install` inside `~/.casen/plugins/<name>/`. No custom package manager logic is needed.

### 3.6 TUI Integration

The TUI (`startTui`) already receives a `CommandGroup[]` parameter. Plugin-contributed groups appear in the TUI's command tree automatically — no additional work needed.

Tab-completion (shell completions) is generated from `CommandGroup[]` at runtime. Plugin commands are included automatically once loaded.

---

## 4. Security Model

Plugin code runs in the same Node.js process as casen, with full access to the file system, network, and environment. This is intentional: plugins need profile access and authenticated clients.

The trust model mirrors `gh` and `kubectl` plugins: **explicit install is the consent mechanism**. Users must run `casen plugin install <name>` to load a plugin. There is no auto-discovery from `$PATH` (unlike `gh`).

Mitigations:
- Plugins are pinned in `~/.casen/plugins/<name>/package.json` (standard npm lockfile semantics).
- `casen plugin update` is explicit — no automatic updates on startup.
- A future `--no-plugins` flag can disable all plugin loading for CI environments where the plugins directory may be untrusted.

---

## 5. `@bpmnkit/cli-sdk` Package

A new package at `packages/cli-sdk` exposes everything plugin authors need without exposing internal app implementation details.

```
packages/cli-sdk/
  package.json        # name: "@bpmnkit/cli-sdk", type: "module"
  src/
    index.ts          # re-exports CasenPlugin, CommandGroup, Command, RunContext
    client.ts         # helper: createZeebeClient(profile), createOperateClient(profile)
    output.ts         # re-exports table(), json(), success(), error() formatters
```

Plugin authors install the SDK as a `devDependency`:

```json
{
  "name": "casen-deploy",
  "devDependencies": {
    "@bpmnkit/cli-sdk": "^1.0.0"
  }
}
```

---

## 6. Candidate Plugins

| Package name | Commands | Value |
|---|---|---|
| `casen-deploy` | `release`, `rollback`, `diff` | Git-tag-aware deploys, changelog from commit log |
| `casen-ci` | `run`, `wait`, `assert` | CI-mode: JUnit XML output, exit codes, timeout control |
| `casen-migrate` | `plan`, `apply`, `status` | Schema migration scripts tied to process versions |
| `casen-templates` | `new`, `scaffold` | Generate starter BPMN/form files from templates |
| `casen-report` | `incidents`, `sla` | Render HTML/PDF reports from incident and SLA data |
| `casen-slack` | `notify`, `alert` | Post incident/deploy events to Slack channels |
| `casen-jira` | `create-ticket`, `link` | Create Jira issues from incidents |
| `casen-pagerduty` | `page`, `ack` | Trigger/acknowledge PagerDuty alerts from incidents |
| `casen-admin` | `tenant`, `cluster` | Tenant/environment provisioning via Management API |

---

## 7. Implementation Order

1. **`packages/cli-sdk`** — define `CasenPlugin` interface; re-export shared types. No runtime code yet.
2. **`apps/cli/src/plugin-loader.ts`** — loader with error isolation per plugin.
3. **Wire into `run.ts`** — `await loadPlugins()` before group assembly.
4. **`casen plugin` command group** — `list`, `install`, `remove`, `update`, `info`.
5. **Reference plugin `casen-deploy`** — validates the contract end-to-end; used in integration tests.
6. **Shell completion update** — ensure completions include dynamically loaded groups.
7. **Documentation** — `casen plugin --help`, README plugin authoring guide.
