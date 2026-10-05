# Plan: Auto-next: spec

Issue: [713-auto-next-spec.md](../../issues/713-auto-next-spec.md)

## Overview

Write `docs/agents/specs/skill-auto-next.md`, the forward-looking spec for the `next_step.auto.<skill>` auto-chaining feature (#712). This issue changes documentation only. #714 (script and config), #715 (skill wiring) and #716 (init-claude, migrations, spec removal) implement against it.

## Context

- Specs live in `docs/agents/specs/<topic>.md` (see `AGENTS.md`, "Specs"). They follow the shape of `docs/agents/specs/shell-engine-removal.md`: `## Status`, `## Goal`, the rule sections, then `## See also`.
- `arcanum/_lib/next_step_prompt.sh` is plain bash and is not engine-dispatched. Its current contract (`--repo`, repeatable `--command`, `CHOICE=yes|no` exit 0, `CHOICE=chat` exit 3, `FALLBACK=chat` + `COMMAND=` exit 4, usage errors exit 1 checked before the TTY probe) is documented in its header and in `docs/agents/architecture/skill-finish.md`.
- `config_chain_read <repo> <namespace> <key>...` (`arcanum/_lib/config_chain.sh`) resolves local state, then repo config, then global config, printing nothing when the key is absent. `repo_config_read` already supports dotted keys through `split(".")` and `getpath`, so `config_chain_read <repo> next_step auto.<skill>` works without changes.
- Current next-step offers on `main`:
  - `enhance-issue/steps/publish.md` offers `/discuss-issue <id>`;
  - `discuss-issue/steps/discuss_and_save.md` offers `/auto-plan-issue <id>` first, then `/auto-resolve-issue <id>`;
  - `plan-issue/steps/write_and_confirm.md` offers `/auto-resolve-issue <id>`;
  - `auto-plan-issue/steps/run.md` prints `Next: /auto-resolve-issue <id>` at top level only.
- Precedent for the prompted migrations: `arcanum/migrations/repos/0.16.1/001–003` (`git.merge_body_mode`): `type: script`, `skippable: true`, `applies_to` set to `local`, `repo` or `global`.

## Implementation Steps

### Step 1 — Write the spec

Create `docs/agents/specs/skill-auto-next.md` with these sections:

- **Status**: proposed, not implemented, tracked by #712. Name the sub-issues that implement it and say that #716 removes the spec.
- **Goal**: an opt-in boolean per source skill that turns a next-step offer into an automatic **chained** (top-level) run.
- **Config keys**: `next_step.auto.enhance-issue`, `next_step.auto.discuss-issue` and `next_step.auto.auto-plan-issue`.
  - Each is read through `config_chain_read <repo> next_step auto.<skill>` and defaults to `false`.
  - Only the JSON boolean `true` enables the chain. Any other value counts as `false`.
  - Include the JSON example, plus a table of key → skipped offer → file.
  - `auto-plan-issue`'s key covers three offers: `auto-plan-issue`'s own top-level `Next:` line, discuss-issue's second offer, and `plan-issue`'s offer.
  - `/arcanum-check-config next_step.auto.<skill>` shows where a value resolves from.
- **Script contract** (`next_step_prompt.sh`):
  - `--auto-key <skill>`: when the key resolves to `true`, print `auto-continuing: <cmd> (next_step.auto.<skill>=true)` and output `CHOICE=yes` and `AUTO=true`, exit 0, with no `/dev/tty` probe. Otherwise the behaviour is unchanged.
  - `--no-prompt`: output `CHOICE=yes` or `CHOICE=no` from config alone and never prompt. It is intended for auto skills.
  - Argument validation still runs first, and the existing output protocol is unchanged.
  - Say which stream carries the notice (stderr, so stdout keeps the key=value protocol), and how `--no-prompt` relates to `--auto-key`. Both are for #714 to implement.
- **Epic rule**: enhance-issue never auto-chains for an issue labeled `Epic`. It checks through `auto-fix-all/scripts/github.sh has-label`, and an Epic keeps the normal offer.
- **Chained versus nested**:
  - A chained run is top level and never `NESTED=true`.
  - A nested `auto-plan-issue` (from discuss-issue or auto-fix-all) never chains.
  - A chain continues hop by hop as long as each hop's key is `true`.
- **Branch safety**: a top-level `auto-plan-issue` auto-chains only when HEAD is the `issue-<id>` branch. `commit_plan.sh` commits on HEAD without pushing, so from a detached `origin/main` the plan would be left behind. discuss-issue and `plan-issue` reach their offers with the plan already pushed on `issue-<id>`.
- **Chaining `auto-resolve-issue`**: invoke it through the `loop` skill (`/loop /auto-resolve-issue <id>`), so `ScheduleWakeup` keeps monitoring the PR. The notice shows that exact command.
- **Enabling**:
  - the init-claude settings step asks for each key and writes it to **repo config** (`.claude/configuration/arcanum-repo-config.json`);
  - two opt-in, skippable migrations in `arcanum/migrations/repos/next/`, one `applies_to: repo` and one `applies_to: global`, prompting per key and modeled on `0.16.1/002–003`.
- **Docs to update during implementation**: `skill-finish.md` (offer contract and next-step map), `shared-state-and-configuration.md`, `docs/guides/arcanum-repo-config.md`, and the README config table.
- **See also**: [Skill Finish](../architecture/skill-finish.md), [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md), [Per-Repo Migrations](../architecture/per-repo-migrations.md), #712.

### Step 2 — Cross-check against the code

Re-read the four offer sites listed in Context, plus `next_step_prompt.sh`'s header, and confirm that every command, file path and flag named in the spec matches `main`. Fix any drift in the spec itself. No code changes.

## Files to Change

- `docs/agents/specs/skill-auto-next.md` — new spec file.

## CI Checks

- None specific. CI runs Node lint and specs under `core/`, which this docs-only change does not touch.

## Notes

- The issue and the parent #712 mention discuss-issue's second offer as `/auto-fix-issue` in older wording. On `main` (since #710) it is already `/auto-resolve-issue`, and the spec should state that.
- The notice-on-stderr and value-validation choices are refinements within the agreed contract. If an implementer disagrees during #714, update the spec in that PR.
