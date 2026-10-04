# Plan: Planning skills suggest /auto-fix-issue instead of /auto-resolve-issue as next step

Issue: [710-auto-plan-issue-suggests-auto-fix-issue-instead-of-auto-resolve-issue-as-next-step.md](../../issues/710-auto-plan-issue-suggests-auto-fix-issue-instead-of-auto-resolve-issue-as-next-step.md)

## Overview
After planning, `auto-plan-issue`, `plan-issue` and `discuss-issue` should all point to `/auto-resolve-issue <id>` (plain, no `/loop`) instead of `/auto-fix-issue <id>`. The skill-file edits belong to `skill-writer`. The matching architecture-doc updates are architect-owned and listed below.

See [skill-writer.md](skill-writer.md) for the full skill-file plan.

## Documentation (architect)
These files are in the architect's own scope (`docs/agents/**`), so no specialist file carries them. The architect applies them directly after the `skill-writer` dispatch:

- `docs/agents/architecture/skill-finish.md`, "Next-step map" table: the `discuss-issue` row becomes `/auto-plan-issue <id>`, run nested; then `/auto-resolve-issue <id>`. The `plan-issue` and `auto-plan-issue` rows become `/auto-resolve-issue <id>`.
- `docs/agents/architecture/skill-finish.md`, "Notes": the `discuss-issue` two-phase-ending bullet ("…then prints one merged report and offers `/auto-fix-issue <id>`") now says `/auto-resolve-issue <id>`.
- `docs/agents/architecture/skill-finish.md`, "Example" (the `plan-issue` report): "followed … by the next-step offer for `/auto-fix-issue 123`" now says `/auto-resolve-issue 123`, since the example is `plan-issue`'s report. The generic `--next` description and the `next_step_prompt.sh` prompt sample only use `/auto-fix-issue 123` as an illustration and can stay.
- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md`, "Closing checkout" bullet: replace the `/auto-fix-issue` offer/chaining wording with `/auto-resolve-issue`. Keep the safety argument, now resting on `auto-resolve-issue/steps/process_one_issue.md`'s Step 1, which re-checks out `issue-<id>` via `checkout_from_main.sh` before anything else.

## Notes
- `core/spec` uses `/auto-fix-issue 12` / `/auto-fix-issue 1` only as arbitrary sample strings for `FinishReport` and `next_step_prompt.sh`. Leave them unchanged. No Node or bash code hardcodes these next steps.
- No CI job covers markdown-only changes (CircleCI runs `yarn test`/`yarn lint` under `core/` only).
