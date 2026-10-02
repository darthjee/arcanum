# Plan: Create-issue: automation skips Epics

Issue: [692-create-issue-automation-skips-epics.md](../../issues/692-create-issue-automation-skips-epics.md)

## Overview

Add an `Epic` guard to the three automation entry points, following the "Automation skips Epics" section of [`docs/agents/specs/arcanum-create-issue.md`](../../specs/arcanum-create-issue.md). There is one change from the spec: `monitor-issues` also keeps Epics out of the rewrite queue. `auto-fix-all/scripts/github.sh has-shipit-label` is generalized into `has-label`, which `/push-issue-to-queue` and `auto-fix-all` both call. `monitor-issues` uses the tags it already parsed. Shell and native change together.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [skill-writer](skill-writer.md)

## Shared contracts

### `has-label` CLI

- `auto-fix-all/scripts/github.sh has-label <repo_path> <id> <name>`: exit `0` when GitHub issue `<id>` has a label equal to `<name>` (case-insensitive, whole name, literal match, not a regex). Exit `1` when it does not, or when fetching the labels fails. No stdout. A missing argument prints `Usage: … has-label <repo_path> <id> <name>` to stderr and exits `1`.
- Engine-dispatch key: `auto-fix-all-github-has-label`, with the shell wrapper `auto-fix-all/scripts/github_shell_has_label.sh` and the native method `AutoFixAllGithub#hasLabel(id, name)`. Forward `HOME`, like the sibling subcommands.
- **Alias**: `github.sh has-shipit-label <repo_path> <id>` stays and keeps its exit codes. In `github.sh` it dispatches to the **same** `auto-fix-all-github-has-label` key with args `<repo_path> <id> shipit`. It has no registry entry, native method or `migration-status.json` key of its own. The old `auto-fix-all-github-has-shipit-label` key, its registry entry, `AutoFixAllGithub#hasShipitLabel`, and `github_shell_has_shipit_label.sh` are removed. Inside `github_shell.sh`, the `has-shipit-label` subcommand stays as a one-line call to `cmd_has_label "$1" "$2" shipit`, because parity specs and direct callers invoke `github_shell.sh` directly.

### `monitor-issues` Epic skip

- The check runs once per processed issue, **before** the actionable-tag dispatch loop, using the tags already parsed: shell `has_tag "$LABELS" epic`, native `Tags.extractTags(labels).includes('epic')`. It makes no GitHub call.
- When the issue is an Epic, it logs exactly `Skipping #<id>: Epic` and dispatches nothing (no `created` push to the rewrite queue, no `ready_for_work` push to the auto-fix-all queue). It then **still records** `updated_at` and `tags`, as on success, so the issue is not reconsidered until it is updated again.

### User-facing messages (skills)

- `/push-issue-to-queue`: `#<id> is an Epic — split it with /arcanum-split-issue`
- `auto-fix-all`: `Skipped #<id>: Epic (split it with /arcanum-split-issue)`
