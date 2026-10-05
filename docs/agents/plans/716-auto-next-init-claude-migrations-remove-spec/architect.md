# Architect Plan: Auto-next: init-claude, migrations, remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- Dotted keys in `repo_config_write`, `global_config_write` and `RepoConfigWriter` (see [plan.md](plan.md#dotted-keys-in-the-config-writers)).
- The init-claude step `setup_auto_next.md`, which writes repo config through the native-only `init-claude-set-next-step-auto`.
- Migrations `next/001` (local), `002` (repo) and `003` (global), prompting `[Y]es/[N]o/[S]kip` per key.

## Implementation Steps

### Step 1 — Fold the spec's remaining rules into the architecture docs

- `docs/agents/architecture/skill-finish.md#auto-next`: make sure every lasting rule from the spec is present:
  - the keys, and that only the JSON `true` counts;
  - the Epic rule with its fail-safe `has-label` exit `2`;
  - chained versus nested (a chained run is top level, nested `auto-plan-issue` never chains, and a chain continues hop by hop);
  - **branch safety** (plan-issue and discuss-issue push before their offer, and top-level `auto-plan-issue` chains only from `issue-<id>` after a successful push through `auto_next.sh`);
  - **`/loop` chaining** (the offered command is `/loop /auto-resolve-issue <id>`, and it is the same command in the offer, the notice and the run).

  Most of this is already in the next-step map notes. Add only what is missing; do not duplicate it.
- `docs/agents/architecture/shared-state-and-configuration.md#the-next_step-namespace`:
  - Replace "The keys are honored only once a skill passes `--auto-key`; that wiring is tracked by #715" with the current state.
  - Fix the `auto-plan-issue` row to `/loop /auto-resolve-issue <id>`.
  - Add an **Enabling** paragraph covering init-claude's `setup_auto_next.md` (repo config), the `next/001`–`003` migrations (local, repo, global, `[Y]es/[N]o/[S]kip`, and that an explicit `false` shadows lower tiers) and `/arcanum-check-config`.
  - Note that `repo_config_write`, `global_config_write` and `RepoConfigWriter` now accept dotted keys, next to the existing sentence about the readers.
- `docs/agents/architecture/script-engine.md`: list `init-claude-set-next-step-auto` among the native-only commands, where `arcanum-check-config` and the `arcanum-create-issue` commands are listed.

### Step 2 — Guides, README, and remove the spec

- `README.md` (the config table, lines ~145–147): drop "takes effect once #715 wires it in", use `/loop /auto-resolve-issue`, and mention init-claude and `/arcanum-migrate` as ways to set the keys.
- `docs/guides/arcanum-repo-config.md` (the `next_step` section): mention how to enable the keys and the `/loop` form. Check `docs/guides/arcanum-global-config.md` and mention the global migration there if it lists keys.
- `auto-plan-issue/scripts/auto_next.sh` header comment: point at `docs/agents/architecture/skill-finish.md#next-step-map` instead of the spec. This is a one-line comment change; make it yourself or hand it to the scripter.
- Delete `docs/agents/specs/skill-auto-next.md`. Then grep the repo (excluding `docs/agents/issues/` and `docs/agents/plans/`) for `skill-auto-next` and `specs/skill-auto` to confirm nothing links to it.

## Files to Change

- `docs/agents/architecture/skill-finish.md`: add the remaining auto-next rules.
- `docs/agents/architecture/shared-state-and-configuration.md`: current state, enabling, and dotted-key writers.
- `docs/agents/architecture/script-engine.md`: the new native-only command.
- `README.md`, `docs/guides/arcanum-repo-config.md`, and possibly `docs/guides/arcanum-global-config.md`: user-facing wording.
- `auto-plan-issue/scripts/auto_next.sh`: header comment link.
- `docs/agents/specs/skill-auto-next.md`: deleted.

## Notes

- Do this last, after the other agents' changes exist, so the docs describe what was actually built (file names, ids, output lines).
- With the spec gone, the parent #712's "Docs are updated, and the spec file is removed" criterion is met.
