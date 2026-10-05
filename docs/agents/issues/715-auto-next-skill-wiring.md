# Issue: Auto-next: skill wiring

## Description
Part of #712. Wire the `--auto-key` / `--no-prompt` flags added to `arcanum/_lib/next_step_prompt.sh` by #714 (merged) into every skill that makes a next-step offer, following the spec in `docs/agents/specs/skill-auto-next.md` (#713).

## Problem
`next_step_prompt.sh` can now auto-continue when `next_step.auto.<skill>` is `true`, but no skill passes the flags yet, so every offer still prompts and the `next_step.auto.*` keys have no effect.

## Expected Behavior
- When `next_step.auto.<skill>` resolves to `true`, the offer is skipped, the `auto-continuing: ...` notice (stderr) is relayed to the user, and the offered command runs as a **chained** top-level run (never `NESTED=true`), exactly as if the user answered `[Y]es`.
- When the key is absent or `false`, every offer behaves exactly as today.
- A chain continues hop by hop while each hop's key is `true`: `/enhance-issue` → `/discuss-issue` → `/auto-plan-issue` → `/loop /auto-resolve-issue`.

## Solution
- **`enhance-issue/steps/publish.md`**: before the `/discuss-issue <id>` offer, check whether the issue is labeled `Epic` (via `auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic`). The check is **fail-safe**: pass `--auto-key enhance-issue` only when the check positively says the issue is not an Epic. If it is an Epic, or the check errors (e.g. network/`gh` failure), omit `--auto-key` and keep the normal offer. `has-label` currently exits 1 for both "no label" and errors, so this needs a way to tell them apart (e.g. a small script or a distinct error exit code).
- **`discuss-issue/steps/discuss_and_save.md` §8**:
  - first offer (`/auto-plan-issue <id>`, run nested) passes `--auto-key discuss-issue`;
  - second offer passes `--auto-key auto-plan-issue`, and its command becomes `/loop /auto-resolve-issue <id>`.
- **`plan-issue/steps/write_and_confirm.md`**: the offer passes `--auto-key auto-plan-issue`, and its command becomes `/loop /auto-resolve-issue <id>`.
- The `/loop` form is used for the offered command itself (manual `[Y]es` included), so the offer, the auto-continuing notice and what actually runs are the same command, and `auto-resolve-issue`'s `ScheduleWakeup` monitoring always works.
- **`auto-plan-issue/steps/run.md`**: only at top level (never with `NESTED=true`), and only when HEAD is the `issue-<id>` branch, call `next_step_prompt.sh --no-prompt --auto-key auto-plan-issue --command "/loop /auto-resolve-issue <id>"`. On `CHOICE=yes`, **push the plan commit** (`git -C "$REPO_PATH" push`) and then chain to `/loop /auto-resolve-issue <id>` after printing the report; if the push fails, do not chain and keep the normal `Next:` line. Otherwise keep printing only the `Next:` line (its text also becomes `/loop /auto-resolve-issue <id>`). This applies to both success exits (plan written, and plan already exists). A nested run never chains.
- Every caller treats `CHOICE=yes` + `AUTO=true` like a user `[Y]es` and relays the notice line.
- **`docs/agents/architecture/skill-finish.md`**: update the next-step map and drop the "until #715" note.
- Update the spec (`docs/agents/specs/skill-auto-next.md`) where these decisions refine it: the `/loop` command in the offers, the push before a top-level `auto-plan-issue` chains, and the fail-safe Epic check.

Branch safety follows the spec: `plan-issue` and discuss-issue have already pushed the plan on `issue-<id>` before their offer, and a chaining top-level `auto-plan-issue` now pushes it too; `auto-resolve-issue` bootstraps the branch itself via `checkout_from_main.sh`.

## Benefits
- Users who opt in can run the whole pipeline from `/enhance-issue` to a merged PR without answering each next-step prompt.
- Opt-in per hop, so default behaviour is unchanged.

## Acceptance criteria
- [ ] enhance-issue never auto-chains for an `Epic`
- [ ] Chained runs are top level, and a nested `auto-plan-issue` never chains
- [ ] A top-level `auto-plan-issue` chains only when HEAD is `issue-<id>`, and pushes the plan before chaining
- [ ] An error in the Epic check never enables auto-chaining
- [ ] Offers for the `auto-plan-issue` key use `/loop /auto-resolve-issue <id>`
- [ ] `auto-plan-issue`'s key also covers discuss-issue's second offer and `plan-issue`'s offer
- [ ] With every key absent/`false`, all offers behave exactly as today
- [ ] The skill-finish.md next-step map is updated
