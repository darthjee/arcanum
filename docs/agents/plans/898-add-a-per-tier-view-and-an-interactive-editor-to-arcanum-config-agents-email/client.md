# Client Plan: Add a per-tier view and an interactive editor to `arcanum config agents email`

Main plan: [plan.md](plan.md)

## Overview
Add two forms to the `agents email` shortcut (`cli/lib/commands/config/shortcuts/agentsEmail.js`):

1. `agents email --all-tiers` — a matrix with a `(default)` row (`git.email`) and one row per agent (repo agents + configured ones), one column per tier (local / repo / global), marking the resolved value, shadowed values, the model-default fallback and `(not in this repo)` agents. `--json` gets a new, separate shape.
2. `agents email edit` — an interactive loop that shows the matrix, asks agent → email (or `-` to unset) → tier → confirm, writes through the same path as `agents email set`/`unset`, re-renders, and finishes on an empty agent answer.

## Context
- Resolution must stay `AgentEmail#resolve` (`shared/lib/config/AgentEmail.js`) so the CLI matches `arcanum/_lib/agent_email.sh`; no change to resolution, config shapes or `setup identity`.
- Existing building blocks: `readEmailTiers()`, `repoAgents()`, `configuredAgents()`, `resolvedFields()`, `showAgent()`/`detailText()` (per-tier marks for one agent) in `agentsEmail.js`; `writeValue`/`delegate`/`checkShortcutFlags` in `shortcuts/common.js`; `askTier`, `confirm`, `UNSET_ANSWER` in `setup/setting.js`; `createPrompter`/`Interrupted` in `cli/lib/prompter.js`; `isInteractive(io, deps)` in `config/setup.js`.
- `--all-tiers` is today refused by `checkReadFlags()`; tier flags and `--unset` must stay refused on read forms, and `--all-tiers` stays refused on the detail form.
- `edit` becomes a reserved verb like `set`/`unset`.

## Steps

- [01 — Per-tier matrix (`--all-tiers`)](client/01-per-tier-matrix.md)
- [02 — Interactive editor (`edit`)](client/02-interactive-editor.md)
- [03 — Help and documentation](client/03-help-and-docs.md)

## CI Checks
- `cli/`: `yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- Keep `agentsEmail.js` readable: move the matrix building/rendering and the editor into sibling modules (e.g. `shortcuts/agentsEmailMatrix.js`, `shortcuts/agentsEmailEdit.js`) if it grows large; `runAgentsEmail` stays the single dispatcher.
- The editor must never hold a write lock while a question is open (same rule as `config setup`): each confirmed answer is one independent `set`/`unset`.
- Exact column layout is free; the information shown (and the JSON shape below) is the contract.
