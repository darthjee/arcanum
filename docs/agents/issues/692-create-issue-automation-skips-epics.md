# Issue: Create-issue: automation skips Epics

## Description

Part of epic #687, built against the contract in [`docs/agents/specs/arcanum-create-issue.md`](../specs/arcanum-create-issue.md) ("Automation skips Epics"). Depends on #688 (spec) and #689 (`Epic` label / `epic` pipeline tag), both shipped.

An issue labeled `Epic` is meant to be split (`/arcanum-split-issue`), not implemented. Today nothing stops the automation pipeline from picking one up.

## Problem

- `monitor-issues` pushes any `Ready for Work` issue onto the `auto-fix-all` queue, and any `Created` issue onto the rewrite queue, Epic or not.
- `/push-issue-to-queue` appends any id to the queue without looking at its labels.
- `auto-fix-all` processes whatever it pops, so an Epic queued earlier (or labeled `Epic` after it was queued) gets planned and implemented.

## Expected Behavior

Three checks, as defined in the spec. Labels can change after an issue is queued, so the post-pop check in `auto-fix-all` is the authoritative one.

| Where | Check | Behavior on `Epic` |
| --- | --- | --- |
| `monitor-issues` | `has_tag epic` on the tags already parsed in the poll (no extra GitHub call) | Does not push the issue to the `auto-fix-all` queue (even with `Ready for Work`) **nor** to the rewrite queue (even with `Created`). Logs `Skipping #N: Epic`. The poll state (`updated_at`, `tags`) is still recorded. |
| `/push-issue-to-queue` | One `has-label` call per id | Refuses that id with `#N is an Epic — split it with /arcanum-split-issue`. The other ids are still pushed. |
| `auto-fix-all`, after each pop | One `has-label` call | Drops the issue, prints `Skipped #N: Epic (split it with /arcanum-split-issue)`, continues with the next id. No user interaction, no label changes. |

- `queue.sh push` itself still makes no GitHub calls.
- Skipping the rewrite queue goes beyond the spec as written, which only skips the `auto-fix-all` queue. The spec is amended to match.
- Shell and native halves of every touched entrypoint change together.

## Solution

- **`has-label`**: generalize `auto-fix-all/scripts/github.sh has-shipit-label` to `has-label <repo_path> <id> <name>` (exit `0` = has the label, case-insensitive; `1` = does not). Keep `has-shipit-label <repo_path> <id>` as a thin alias for `has-label … shipit`. Shell (`github_shell_has_shipit_label.sh` → generalized) and native together. Natively, register a new `auto-fix-all-github-has-label` command in `core/lib/core/commands.js`, backed by one implementation on `IssueTagger#hasLabel(id, name)`. `has-shipit-label` routes to it with `name=shipit`, so it is only a thin dispatch alias, not a second implementation. This settles the spec's open point.
- **`monitor-issues`**: in `monitor_issues_shell.sh` and `MonitorIssuesMonitorIssues.js`, check `has_tag epic` once, before the actionable-tag dispatch loop. If it is set, skip both the `ready_for_work` (auto-fix-all queue) and `created` (rewrite queue) dispatches, log `Skipping #N: Epic`, and still record `updated_at`/`tags`.
- **`push-issue-to-queue`**: in `SKILL.md`, call `../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic` for each id. Print the refusal message for each Epic, then run one `queue.sh push` with the ids that are left (skip the push if none are left). No new script and no new entrypoint.
- **`auto-fix-all`**: in `steps/process_one_issue.md`, right after the pop, call `has-label <id> Epic`; on exit `0` print the skip message and move to the next id.
- **Docs**: update the `epic` paragraph in `docs/agents/architecture/issue-tags.md`. In the spec, mark #692 shipped, add the rewrite-queue skip to the "Automation skips Epics" table, and close the `has-label` open point. Add `auto-fix-all-github-has-label` to `entrypoint-migration-status.md`.
- **Tests**: `has-label` parity specs (with the `has-shipit-label` alias still covered); `monitor-issues` parity: `Ready for Work` + `Epic` is not pushed to the auto-fix-all queue, and `Created` + `Epic` is not pushed to the rewrite queue; `push-issue-to-queue`: an Epic is refused and the other ids are pushed; `auto-fix-all`: a popped Epic is skipped. Gates: `make core-check`, jscpd, c8 coverage threshold.

## Benefits

- Tracking issues (Epics, including split parents that keep `Epic` via `mark-split`) are never planned or implemented by mistake.
- Clear, consistent messages tell the user why an issue was skipped and what to do instead.
