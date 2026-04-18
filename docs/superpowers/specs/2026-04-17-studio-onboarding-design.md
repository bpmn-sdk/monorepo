# Studio Onboarding Design

**Date:** 2026-04-17
**Scope:** `apps/studio`

## Problem

First-time users open Studio and have no clear path forward. The existing "Get Started" section on the Dashboard is only visible when connected to a cluster with zero definitions/instances, is static, and doesn't explain how to connect a Zeebe cluster via the CLI. Users get lost.

## Goals

- Expert users (know BPMN/Camunda) can immediately open a real example and explore
- New users understand what Studio is and how to connect it to a Zeebe cluster
- Neither group is blocked by a lengthy setup wizard

## Design

### Pattern

**Welcome modal on first visit → opens example directly → collapsible checklist on Dashboard**

Follows industry standard (Linear, Vercel, Figma): one immediate high-value CTA, then tracked progress for the remaining setup steps. No dedicated nav tab (users never revisit them).

---

### 1. Welcome Modal

**Trigger:** Shown once on first app open. Tracked via `localStorage["bpmnkit:onboarding-seen"] = "true"`. Setting this key before modal closes prevents double-show.

**Content:**
- Headline: "Welcome to BPMNkit Studio"
- Subtext: short tagline (e.g. "Design, deploy, and monitor BPMN processes for Zeebe")
- Two primary CTAs (side by side, equal weight):
  - **"Open example process"** — creates the "Fetch and Summarize Webpage" template model in IndexedDB and navigates to the editor. Sets `localStorage["bpmnkit:onboarding-example-opened"] = "true"`.
  - **"Start from scratch"** — navigates to `/models` and opens the new-model dialog
- Tertiary link: "Already have a cluster? Connect it →" → navigates to `/settings`
- "Skip for now" text link (bottom, muted) — dismisses modal without action

**Example process:** `tpl-fetch-summarize-webpage` (id from `PROCESS_TEMPLATES`). This template makes an HTTP scrape request then summarizes with AI — demonstrates both HTTP and LLM worker types in one short process.

**Dismissal:** Any action (CTA click, skip, or backdrop click) sets `bpmnkit:onboarding-seen` and hides the modal.

**Re-access:** "Get started" link in sidebar (see section 3) re-opens the modal at any time.

---

### 2. Dashboard Checklist (persistent, collapsible)

Rendered at the top of `Dashboard.tsx`, above all stats cards. Visible until the user hides it or completes all 4 steps.

**Visibility state (localStorage keys):**
- `bpmnkit:onboarding-hidden` — user explicitly dismissed; checklist never shows again
- `bpmnkit:onboarding-seen` — modal has been shown; checklist activates

**Collapsed state:** Single slim bar showing "N/4 steps complete · Show". Expands on click.

**Expanded state:** 4 step rows. Each row:
- Checkmark (green when complete, muted circle when not)
- Step title + one-line description
- Action link/button (only shown when not yet complete)

**Steps:**

| # | Title | Complete when | Action |
|---|-------|--------------|--------|
| 1 | Open an example process | `localStorage["bpmnkit:onboarding-example-opened"]` is set | "Open example →" → same action as modal CTA |
| 2 | Connect a Zeebe cluster | `activeProfile` exists in `useClusterStore` (i.e. a cluster profile is configured) | Inline CLI snippet + "Configure in Settings →" |
| 3 | Deploy a definition | `stats.deployedDefinitions > 0` | "Go to Definitions →" |
| 4 | Run your first instance | `stats.runningInstances > 0` OR `localStorage["bpmnkit:onboarding-instance-started"]` set | "Start an instance →" |

**Step 2 inline expansion:** When step 2 is not complete and the row is focused/hovered, show a collapsible CLI block:

```sh
# Install the CLI
npm install -g @bpmnkit/cli

# Add a Zeebe profile
casen profile add my-cluster \
  --base-url https://... \
  --auth-type oauth2 \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET

# Launch Studio connected to that cluster
casen studio --profile my-cluster
```

Plus a "Configure manually in Settings →" link for users who prefer the UI.

**Controls:**
- "Collapse" / "Expand" toggle
- "Hide" button (top-right) → sets `bpmnkit:onboarding-hidden`, permanently removes checklist from Dashboard. No undo in UI (user can reopen modal via sidebar link).

**Auto-collapse:** When all 4 steps complete, checklist auto-collapses to a success bar ("All set! You're ready to automate."). On the next page navigation, it disappears permanently (sets `bpmnkit:onboarding-hidden`).

---

### 3. Sidebar "Get started" Link

Location: bottom of the left sidebar nav (`Sidebar.tsx`), above the project picker / profile section.

- Label: "Get started"
- Icon: `Sparkles` or `BookOpen` (lucide)
- Dot indicator: shown when `!localStorage["bpmnkit:onboarding-hidden"]` and not all 4 steps done
- Click: sets a Zustand UI flag `showWelcomeModal: true` (in `useUiStore` or a local `useState` in `app.tsx`) to re-open the modal without touching localStorage. `onboarding-seen` stays set so the modal doesn't auto-show again on next reload.

Disappears entirely once `bpmnkit:onboarding-hidden` is set.

---

## Data & State

| Key | Location | Value | Purpose |
|-----|----------|-------|---------|
| `bpmnkit:onboarding-seen` | localStorage | `"true"` | Modal shown at least once |
| `bpmnkit:onboarding-example-opened` | localStorage | `"true"` | Step 1 complete |
| `bpmnkit:onboarding-hidden` | localStorage | `"true"` | User dismissed checklist |
| `bpmnkit:onboarding-collapsed` | localStorage | `"true"` | Checklist collapsed (not hidden) |
| `bpmnkit:onboarding-instance-started` | localStorage | `"true"` | Step 4 complete (set when user starts first instance via UI) |

Stats for steps 3 and 4 come from the existing `useDashboardStats` hook (already used in Dashboard).

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `OnboardingChecklist` component at top of page |
| `src/layout/Sidebar.tsx` | Add "Get started" link at bottom of nav |
| `src/components/WelcomeModal.tsx` | New component — welcome modal |
| `src/app.tsx` | Render `WelcomeModal` at app root (so it appears on any first page, not only Dashboard) |

## Out of Scope

- Server-side onboarding state sync
- Per-user onboarding analytics
- Interactive BPMN tutorial / guided tour
- Video embeds
