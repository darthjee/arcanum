---
name: auto-resolve-issue
description: Autonomously takes one issue through the full pipeline (new issue → plan → fix → PR → monitor → merge), rescheduling itself via ScheduleWakeup while the PR is pending (run it via /loop). Asks the user only when the PR is closed without merging or a specialist dispatch is blocked. Usage: /auto-resolve-issue <id> or /auto-resolve-issue #<id>
---

You are the coordinator. Your job is the things the `architect` agent cannot do itself (`ScheduleWakeup` while the PR is pending, asking the user what to do about a closed PR, asking the user what to do about a blocked specialist dispatch). Everything else (implementation, PR review, comments, CI) is delegated to a spawned `architect` agent. Follow the steps below precisely and in order.

This is the single-issue form of `auto-fix-all`: the same per-issue pipeline, with no queue. The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

No script lives in this skill folder. `../auto-fix-all/scripts/github.sh` is the `auto-fix-all` skill folder's `scripts/github.sh`, and `../arcanum/_lib/finish_report.sh` is the shared report script; both paths are relative to this (`auto-resolve-issue`) skill folder.

## Step 1 — Resolve REPO_PATH

Resolve `REPO_PATH="$(pwd)"`, the one moment the target project's root can be trusted from ambient cwd. Resolve it fresh on every invocation, including each `ScheduleWakeup` re-entry, since a fresh invocation is a fresh trust point. Thread it explicitly through every script call below and into the `Agent(architect, ...)` spawn in Step 4.

## Step 2 — Parse the issue id

Take `<id>` from the skill arguments. Accept both `99` and `#99` (strip a leading `#`).

If no id was given, end with the closing report (Step 6) using `--status failed --summary "No issue id given. Usage: /auto-resolve-issue <id>"`.

## Step 3 — Epic check

```bash
../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic
```

- **Exit 0 (Epic)**: do not spawn anything and ask nothing. End with the closing report (Step 6) using `--status declined --summary "Issue #<id> is an Epic; split it with /arcanum-split-issue <id>." --issue <id>`.
- **Any non-zero exit**: treat it as not an Epic (a label-fetch failure must not block the run) and continue to Step 4.

## Step 4 — Spawn the architect

> Agent(subagent_type: "architect", prompt: "Read steps/process_one_issue.md (resolved relative to the `auto-resolve-issue` skill folder) and follow it for issue `<id>`. REPO_PATH: `<resolved_path>`. Report OUTCOME=merged, OUTCOME=closed PR_NUMBER=`<n>`, OUTCOME=blocked AGENT=`<agent-name>` ACTION=`<description>`, or OUTCOME=pending PR_NUMBER=`<n>`.")

Wait for the agent to finish, then parse `OUTCOME` from its report and proceed to Step 5.

## Step 5 — React to the outcome

### `OUTCOME=merged`

The PR number is not part of this outcome. Resolve it if you don't already have it from an earlier outcome of this run:

```bash
../auto-fix-all/scripts/github.sh pr-number "$REPO_PATH"
```

End with the closing report (Step 6) using `--status success --summary "Issue #<id> resolved; PR merged." --issue <id> --pr <n>`. No next-step offer.

### `OUTCOME=pending PR_NUMBER=<n>`

The PR isn't at a terminal state yet. Call `ScheduleWakeup(delaySeconds=300, prompt="/auto-resolve-issue <id>", reason="waiting for PR #<n> to reach a terminal state")` and stop. This is not an exit: print no closing report.

`ScheduleWakeup` only works when the skill was invoked as `/loop /auto-resolve-issue <id>`. If it wasn't, say so plainly to the user (PR #`<n>` is still pending; re-run as `/loop /auto-resolve-issue <id>` to keep monitoring it) instead of silently doing nothing.

Each wakeup re-enters this skill fresh from Step 1 and spawns a brand-new `architect` at Step 4. The idempotent guards in `process_one_issue.md` (branch reuse in `checkout_from_main.sh`, "plan already exists" skip, PR already exists) fast-forward it straight back to "Monitor the PR" for one more one-shot check.

### `OUTCOME=closed PR_NUMBER=<n>`

This is one of the two points where you ask the user something. The spawned architect cannot, so it stopped and handed this back to you. Ask with `AskUserQuestion`:

> PR #`<n>` for issue `<id>` was closed without merging. What would you like to do?
>
> 1. Reimplement from scratch (start over from a clean `main` for this issue)
> 2. Stop

- **Reimplement**: discard the rejected branch first, since `process_one_issue.md`'s branch bootstrap reuses an existing `issue-<id>` branch instead of always recreating it:

  ```bash
  ../auto-fix-all/scripts/github.sh cleanup-branch "$REPO_PATH" <id>
  ```

  Then go back to Step 4. The fresh `architect` finds no `issue-<id>` branch and creates a clean one from `main`.
- **Stop**: end with the closing report (Step 6) using `--status declined --summary "PR #<n> for issue #<id> was closed without merging; stopped." --issue <id> --pr <n>`.

### `OUTCOME=blocked AGENT=<agent> ACTION=<description>`

This is the other point where you ask the user something. A specialist dispatch was denied by Claude Code's own permission classifier, so the spawned architect stopped instead of silently doing the work itself. Ask with `AskUserQuestion`:

> A specialist dispatch to `<agent>` was blocked while processing issue `<id>` (action: `<description>`). What would you like to do?
>
> 1. Retry (e.g. after granting the needed permission out-of-band)
> 2. Stop

- **Retry**: go back to Step 4. `process_one_issue.md`'s branch bootstrap reuses the existing `issue-<id>` branch/PR, so this resumes from where the block occurred.
- **Stop**: end with the closing report (Step 6) using `--status declined --summary "Dispatch to <agent> blocked (<description>); stopped." --issue <id>`.

Deliberately no "do it yourself" option, same as `auto-fix-all`: that would recreate the exact behavior this outcome exists to prevent.

## Step 6 — Closing report

Every exit of this skill (the `success`, `declined` and `failed` paths above) ends with:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-resolve-issue --status success|declined|failed --summary "<one line>" [--issue <id>] [--pr <n>]
```

Relay its stdout to the user verbatim, as the last thing you print. Do not summarize, reformat or add to it. Pass no `--next` on any path. See [Skill Finish](../docs/agents/architecture/skill-finish.md).

The `pending` reschedule in Step 5 is not an exit and prints no report.

Do not ask for confirmation at any point except the two explicit questions above, for the `closed` and `blocked` outcomes.
