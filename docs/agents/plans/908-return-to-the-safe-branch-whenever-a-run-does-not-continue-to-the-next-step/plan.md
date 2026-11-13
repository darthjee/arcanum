# Plan: Return to the safe branch whenever a run does not continue to the next step

Issue: [908-return-to-the-safe-branch-whenever-a-run-does-not-continue-to-the-next-step.md](../../issues/908-return-to-the-safe-branch-whenever-a-run-does-not-continue-to-the-next-step.md)

## Overview

A top-level `auto-plan-issue` run that does not chain into `/loop /auto-resolve-issue <id>` ends on `issue-<id>`. It also never marks the issue `Ready`, and only pushes the plan when it chains. We extend the `auto-plan-issue-auto-next` command (`auto_next.sh`: shell twin + native twin) so that, whenever HEAD is `issue-<id>`, it always pushes and marks `Ready`, and on a non-chaining exit it also releases the working tree to the safe branch. `run.md` keeps a single call site and only learns the new output lines.

## Audit result

Every skill exit behind a next-step offer or an auto-next decision was checked:

- `plan-issue` (`write_and_confirm.md`), `enhance-issue` (`publish.md`, `dialogue.md`), `arcanum-split-issue` (`push.md`) and `discuss-issue` (push-only and plan-it paths): already release the working tree before or at their offer. No change needed.
- `arcanum-create-issue` (`publish.md`): never checks out `issue-<id>`. No change needed.
- `discuss-issue`'s `CLEAR=true` hand-off: stays on `issue-<id>` on purpose. It is fixed indirectly by the top-level `auto-plan-issue` change below, plus a doc note in `discuss_and_save.md`.
- **Top-level `auto-plan-issue`** (both the Step 6 exit and the "plan already exists" exit): the only broken exit. It is fixed here.

## Agents involved

- [scripter](scripter.md): shell twin `auto_next_shell.sh` and the `auto_next.sh` shim's env allowlist.
- [node](node.md): native twin `AutoPlanIssueAutoNext.js` and its specs (unit + parity + engine dispatch).
- [skill-writer](skill-writer.md): `auto-plan-issue/steps/run.md`, `auto-plan-issue/SKILL.md` and `discuss-issue/steps/discuss_and_save.md`.

The architect (coordinator) updates the architecture docs. See "Docs (architect)" below.

## Shared contracts

### `auto_next.sh <repo_path> <id>` — new flow (both twins must match byte for byte)

1. Usage errors: unchanged (nothing on stdout, error on stderr, exit 1).
2. HEAD is not `issue-<id>`: print `CHAIN=no` / `REASON=branch`, exit 0. No config read, no push, no label change, no checkout.
3. Run `next_step_prompt.sh --auto-key auto-plan-issue --no-prompt` (unchanged; its stderr passes through). A failure still means exit 1 with nothing on stdout. Record `auto` (`CHOICE=yes`) and `clear` (`CLEAR=true`).
4. `git -C <repo_path> push`, **always**, not just when chaining. Git output goes to stderr. On failure: print `CHAIN=no` / `REASON=push` and exit 0, staying on `issue-<id>`. No mark-ready, no checkout.
5. Mark the issue `Ready` (same transition as `github_issue.sh mark-ready`: add `ready`, remove `refined`). Best-effort: all of its own output goes to **stderr**. `ready` = true when it completed without error, else false.
6. If `auto`: print `CHAIN=yes`, then `CLEAR=true` if `clear`, then `READY=true|false`. Stay on `issue-<id>`.
7. Otherwise, release to the safe branch (same behavior as `checkout_safe_branch.sh`: dirty tracked tree → refuse; else fetch -p + checkout the configured safe branch). Best-effort: its `BRANCH=` line and any error go to **stderr**, never stdout. Print `CHAIN=no`, `REASON=config`, `READY=true|false`, `RELEASED=true|false`. Exit 0 in every case: a refused release is not a failure.

Stdout forms (key=value lines only, in this exact order):

```text
CHAIN=yes            CHAIN=yes            CHAIN=no            CHAIN=no             CHAIN=no
READY=<b>            CLEAR=true           REASON=config       REASON=push          REASON=branch
                     READY=<b>            READY=<b>
                                          RELEASED=<b>
```

`CLEAR` only ever directly follows `CHAIN=yes`. `READY`/`RELEASED` never appear after `REASON=push|branch`.

### `run.md` consumption (skill-writer relies on the above)

- `READY=true` → the success report gets `--label-change refined:ready`.
- `RELEASED=false` → one line after the report: the release to the safe branch was refused, quoting stderr.
- `AUTO_CLEAR=` / `AUTO_NEXT=` control lines: unchanged.

## Docs (architect)

- `docs/agents/architecture/skill-finish.md`:
  - In `#clearing`, drop the "Known gap" bullet and say the top-level `auto-plan-issue` now pushes, marks Ready and releases.
  - In `#auto-next`, document the new `auto_next.sh` output lines, and state the rule: a run that does not chain into a step needing `issue-<id>` ends pushed and on the safe branch.
  - Line ~267: update the `discuss-issue` bullet's `CLEAR=true` sentence.
- `docs/agents/architecture/config-keys.md`: in the `next_step.auto.<skill>` row, note that `auto_next.sh` also pushes, marks Ready and releases.
- `docs/agents/architecture/docker-engine.md`: mention that `auto-plan-issue-auto-next` now also needs `gh` credentials on the host (env allowlist).

## Notes

- Behavior change: with `next_step.auto.auto-plan-issue=false`, the plan is now pushed (before, it was left local). This is intended (the issue's "work pushed" rule).
- Nested runs never call `auto_next.sh`, so the caller (e.g. `discuss-issue`'s plan-it path) keeps owning push / mark-ready / release. Unchanged.
