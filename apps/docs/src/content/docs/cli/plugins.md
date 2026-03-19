---
title: casen Plugins
description: Official casen CLI plugins shipped with the BPMN Kit monorepo.
---

:::note[Auto-generated]
This page is generated from `plugins-cli/*/package.json` during the docs build. Do not edit manually.
:::

Official plugins extend `casen` with domain-specific command groups. Install them with:

```sh
casen plugin install <name>
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [`@bpmnkit/casen-report`](#-bpmnkit-casen-report) | Render HTML reports from Camunda 8 incident and SLA data |

---

## `@bpmnkit/casen-report`

Render HTML reports from Camunda 8 incident and SLA data

### Installation

```sh
casen plugin install @bpmnkit/casen-report
```

| Command | Description |
|---------|-------------|
| `casen report incidents` | Generate an HTML report of current incidents grouped by process |
| `casen report sla` | Generate an SLA compliance report for process instances |

---

## Authoring Plugins

See the [Plugin Authoring](/cli/plugin-authoring/) guide to build and publish your own `casen` plugin.
