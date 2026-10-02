# Skill-writer Plan: Create-issue: automation skips Epics

Main plan: [plan.md](plan.md)

## Shared contracts

- Consumes `auto-fix-all/scripts/github.sh has-label <repo_path> <id> Epic` (exit `0` = Epic, `1` = not). Treat any non-zero exit as "not an Epic". The post-pop check in auto-fix-all is the one that decides, so a label-fetch failure must not block the queue.
- Messages, verbatim: `#<id> is an Epic — split it with /arcanum-split-issue` (push-issue-to-queue) and `Skipped #<id>: Epic (split it with /arcanum-split-issue)` (auto-fix-all).

## Steps

- [01 — `/push-issue-to-queue` refuses Epics](skill-writer/01-push-issue-to-queue.md)
- [02 — `auto-fix-all` skips a queued Epic](skill-writer/02-auto-fix-all.md)
- [03 — Docs](skill-writer/03-docs.md)

## Notes

- The skill-level loops in push-issue-to-queue and auto-fix-all have no unit tests. Their deterministic part (`has-label`) is covered by node's parity specs. Run `skill-reviewer` on the changed skill files.
