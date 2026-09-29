# Issue: Skill finish: discuss-issue

## Description

Parent: #658. The spec from #659 (`docs/agents/specs/skill-finish.md`) is merged, so this issue is no longer blocked.

Change the ending of `discuss-issue` (`discuss-issue/steps/discuss_and_save.md`, step 8 and every early exit) to follow the standard skill finish in the spec: a closing report rendered by `arcanum/_lib/finish_report.sh`, followed by a `/dev/tty` next-step offer from `arcanum/_lib/next_step_prompt.sh`.

According to the spec's implementation order, this is the first skill sub-issue to be implemented. It therefore also delivers the shared scripts that every other `Skill finish:` sub-issue depends on.

## Problem

`discuss-issue` currently ends with its own format. After pushing the issue, it asks the free-form question "Would you like me to start planning this issue now?" and interprets the answer with `confirm.sh`. If the user says yes, it bootstraps `issue-<id>`, commits the issue file, runs `auto-plan-issue` inline, pushes, marks the issue `Ready`, and releases the tree. It then stops with an ad-hoc message. If the user says no, it releases the tree without printing a structured report. Early failures, such as a dirty tree in `resolve_and_fetch.sh` or a failed push, never produce a report.

The shared scripts named in the spec do not exist yet: `finish_report.sh`, `finish_report_shell.sh`, the native `finish-report` command, and `next_step_prompt.sh`.

## Expected Behavior

- **Shared scripts** (delivered first, in this issue):
  - `scripter` adds `arcanum/_lib/finish_report.sh`, a shim that goes through `engine_dispatch.sh`, and `arcanum/_lib/finish_report_shell.sh`. Together they implement the report format, `--nested` output and `--merge` rules exactly as specified.
  - `scripter` adds `arcanum/_lib/next_step_prompt.sh`: a plain bash `/dev/tty` prompt with `[Y]es/[N]o/[C]hat` and the `CHOICE=...` / exit `3` protocol.
  - `node` adds the native `finish-report` command in `core/lib/` with a shell-vs-native parity spec, and flips `finish-report` to `true` in `arcanum/_lib/migration-status.json`.
- **discuss-issue ending**:
  1. After a successful push (`update` + `mark-refined`), offer `/auto-plan-issue <id>` via `next_step_prompt.sh`. This replaces the free-form question and the `confirm.sh` call in step 8.
  2. On `CHOICE=yes`: keep the existing flow (bootstrap `issue-<id>`, commit the issue, push, `mark-ready`, release the tree). Run `auto-plan-issue` **nested**, passing `NESTED=true`. Then print one merged `SUCCESS` report (`Issue:` link, `Refined -> Ready` in addition to the refine label change) and offer `/auto-fix-issue <id>`. If that second offer is accepted, chain `auto-fix-issue` inline as a top-level run. This replaces the current "do not continue into auto-fix-issue" rule.
  3. `auto-plan-issue` does not emit a `--nested` block until #665 lands. Until then, `discuss-issue` builds its own report data (issue link, `Refined -> Ready`) and passes `--merge` only when `auto-plan-issue` actually returns a `FINISH_*` block. #665 makes the block appear, and no change to `discuss-issue` is needed afterwards.
  4. On `CHOICE=no`, `CHOICE=chat` (exit `3`), or prompt unavailable (exit `1`): print the push-only `SUCCESS` report (issue link and refine label change) with no second offer. On exit `1`, also tell the user in one line that the prompt was unavailable.
  5. **Declined**: if the user explicitly abandons the refinement during the dialogue (for example, "stop" or "drop it"), print a `DECLINED` report: no push, no label change, no offer. Answering "no" to the comprehension check is not a decline; it keeps looping as it does today.
  6. On any failure that stops the skill: print a `FAILED` report whose summary names the failed step. This covers a failed resolve/fetch, a failed push/update, a `checkout_from_main.sh` failure, a commit or plan failure, and a failed plan push. The report includes only the links and label changes that actually happened, and has no offer.
- **Label changes** in the report reflect what actually changed. For example, `Created -> Refined` if `Created` was present, otherwise `(none) -> Refined`.

## Solution

- Implement the shared scripts first (`scripter` + `node`) against the interfaces in `docs/agents/specs/skill-finish.md`.
- `skill-writer` rewrites `discuss-issue/steps/discuss_and_save.md` step 8 (and adds report calls on the failure exits in `extract_id_and_name.md` and the push step) to call `finish_report.sh` / `next_step_prompt.sh`, and to pass `NESTED=true` into `auto-plan-issue/steps/run.md`.
- `confirm.sh` stays for the step 7 comprehension check, which is a mid-flow question and not the finish.

## Benefits

- `discuss-issue` ends in the same readable, fixed format as every other in-scope skill.
- The next pipeline step (`/auto-plan-issue`, then `/auto-fix-issue`) is always shown as an exact command. The user can accept it or run it later.
- The shared scripts become available for the remaining `Skill finish:` sub-issues (#661–#667).

## Acceptance criteria

- [ ] `finish_report.sh` (shell + native, with a parity spec) and `next_step_prompt.sh` exist and match the spec interfaces; `finish-report` is `true` in `migration-status.json`
- [ ] `discuss-issue` ends with the standard closing report on every exit path (success, declined, failed)
- [ ] The next step matches the spec: offer `/auto-plan-issue <id>` (run nested), then offer `/auto-fix-issue <id>`
