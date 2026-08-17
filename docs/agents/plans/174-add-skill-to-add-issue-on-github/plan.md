# Plan: Add skill to add issue on github

Issue: [174-add-skill-to-add-issue-on-github.md](../../issues/174-add-skill-to-add-issue-on-github.md)

## Overview

Add a shared internal script, `arcanum/_lib/spawn_issue.sh`, that lets `enhance-issue`/`discuss-issue` (and a refactored `arcanum-split-issue`) spin off a brand-new GitHub issue mid-dialogue: it creates the issue with a safely filtered (allow-list, not deny-list) label set copied from the parent issue, tags it with a new permanent `Spawned` label, optionally links it back to the parent (comment cross-reference always, native GitHub sub-issue link on request), and never leaves a local file behind to be accidentally committed. `arcanum-split-issue/scripts/create_sub_issue.sh` is refactored to delegate its own create+label+link logic to this shared script. The new `Spawned` label is registered in the canonical tag table and the `init-claude` label registry, and synced onto already-onboarded repos via a new migration.

## Context

Today, when the agent is mid-dialogue in `enhance-issue`/`discuss-issue` and the discussion surfaces something that deserves its own GitHub issue, there is no default way to create it — in practice this has led to the agent committing the new issue's draft file directly to `master`. This plan closes that gap structurally: the new script never persists a local file past the GitHub create call, so there is nothing left to mistakenly commit. See the issue file for the full design rationale (label allow-list security reasoning, linking-back decision, migration shape, edge cases).

## Implementation Steps

### Step 1 — Register the `Spawned` tag

Add `spawned` ↔ `Spawned` to `arcanum/_lib/tags.sh`'s canonical-tag/label-name mapping (`_tag_label_for` and `_tag_for_label` case statements), alongside the existing `split`/`Split` entry. No mutation ever removes this tag (it's applied once, at creation time, directly via the create call's label list — never through `tag_mutate_add_label`), but registering it means `has_tag`/`extract_tags` recognize it wherever a future script checks an issue's labels.

### Step 2 — Register the label color

Add `Spawned:6a737d` to `init-claude/scripts/lib/label_config.sh`'s `DEFAULT_LABEL_PAIRS` array, so freshly onboarded repos get the label from `init-claude`'s normal label-sync flow without any extra step.

### Step 3 — Write `arcanum/_lib/spawn_issue.sh`

New script, signature `spawn_issue.sh <repo_path> <parent_id> <title> <body_file> [--as-subissue]`. Follow `arcanum/_lib/github_issue.sh`'s and `arcanum-split-issue/scripts/create_sub_issue.sh`'s existing conventions (usage-comment header, `set -euo pipefail`, `repo_path_enter`/`_load_origin` sourcing, `STATUS=`/`ID=` key=value output).

Operation order: **create (retried) → fetch/apply labels (best-effort) → linking/comments (best-effort) → delete scratch file.**

1. **Create**: call `arcanum/_lib/github_issue.sh create <repo_path> <title> <body_file>` (unchanged), wrapped in a retry loop matching `create_sub_issue.sh`'s existing one — `max-retry-count`/`error-sleep-time` read from `.claude/state/arcanum-config.json`'s `"plan-issues"` section (default 5 retries / 5s sleep, same fallback as today). Parse `ID`/`FILE` from its output. On exhausted retries: print `STATUS=failed`, exit 1 (leave nothing to clean up — `cmd_create` only writes `FILE` on a successful call).
2. **Labels**: fetch `<parent_id>`'s current labels (`gh issue view <parent_id> -R <repo_ref> --json labels -q '.labels[].name'`). Filter: drop any label whose `_tag_for_label` (from `tags.sh`) resolves to a canonical pipeline tag (this automatically excludes `shipit`, `created`, `refined`, `ready`, `working`, `enqueued`, `idea`, `writting`, `enhancing`, `fetched`, `pr`, `planning`, `split`, `question`, `ready_for_work`), keep everything else, then always add `Spawned`. Apply via `gh issue edit <new_id> -R <repo_ref> --add-label ...`. Best-effort: a `gh` failure logs a warning to stderr, does not fail the script. If the parent lookup itself fails, fall back to applying just `Spawned` alone.
3. **Linking back**: always post a comment on the parent ("Spawned issue #<new_id>: <title>") and on the new issue ("Spawned from #<parent_id>") via `gh issue comment`. When `--as-subissue` is passed, additionally run the same `addSubIssue` GraphQL mutation `create_sub_issue.sh` currently has inline (`gh api graphql -f query='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(...)}' ...`), with the same "created but not linked; link it manually on GitHub" warning fallback. Both best-effort.
4. **Cleanup**: `rm` the scratch file (`FILE` from step 1). On failure, print a *loud* warning (this is the exact failure mode the feature exists to prevent) but still exit 0/`STATUS=ok` — the issue itself was created successfully.
5. **Output**: `STATUS=ok` / `ID=<new_id>` / `URL=<url>` on success.

### Step 4 — Refactor `arcanum-split-issue/scripts/create_sub_issue.sh`

Replace its inline `gh issue create` + label-building (`Planning`→`Writting` swap) + `addSubIssue` GraphQL call with a single call to `../../arcanum/_lib/spawn_issue.sh "$REPO_PATH" "$ISSUE_ID" "$TITLE" <temp_body_file> --as-subissue` (parse title/body from the sub-issue draft file into a temp file first, same parsing it already does). Keep its own count-segment logging and `.claude/state/issue-<id>.json` `sub-issues` append on top of the returned `ID`. Note: this changes sub-issue label behavior from "parent's labels with `Planning` swapped for `Writting`" to "parent's labels with every pipeline tag stripped, plus `Spawned`" (per the allow-list policy in Step 3) — `Writting` is not part of the pipeline-tag strip list, so it is unaffected either way if present, but a parent with `Planning` will no longer have it swapped in on the child. Confirm this reads correctly against `docs/agents/architecture/issue-tags.md`'s existing description of this flow before finishing Step 6 below.

### Step 5 — Write the migration

New files under `arcanum/migrations/repos/next/`: `001.sh` and `001.md` (register `001` in `arcanum/migrations/repos/next/migrations.json`, currently `[]` — `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "repo"}`). `001.sh` supports `config`/`run` subcommands like the existing 0.16.0/0.15.0 migrations:

- `config`: prints `{"skippable": true}`.
- `run`: creates/updates the `Spawned:6a737d` label directly on the repo's live GitHub labels (case-insensitive match-then-create-or-update, same logic `init-claude/scripts/sync_labels.sh` already has). If `.claude/state/init-claude-config.json` exists, also upserts `Spawned:6a737d` into it via `init-claude/scripts/write_label_config.sh add`. No `/dev/tty` confirmation prompt — runs silently in both interactive and non-interactive contexts (unlike the shipit-permission migrations), printing an informational line either way.

### Step 6 — Wire the new capability into `enhance-issue`/`discuss-issue`, and document the tag

- Add a short note to `enhance-issue/steps/dialogue.md` (step 4, "Dig into the chosen topic") and `discuss-issue/steps/discuss_and_save.md` mentioning `arcanum/_lib/spawn_issue.sh` as the way to spin off a new issue mid-dialogue, and the `--as-subissue` judgment call (genuine work-breakdown piece vs. tangential concern) described in the issue file.
- Add a `spawned`/`Spawned` paragraph to `docs/agents/architecture/issue-tags.md` (table row + prose), following the existing style of the `split`/`planning` paragraph, and update the "Callers" it lists for label mutation primitives if relevant.

## Files to Change

- `arcanum/_lib/tags.sh` — register `spawned` ↔ `Spawned`.
- `init-claude/scripts/lib/label_config.sh` — add `Spawned:6a737d` to `DEFAULT_LABEL_PAIRS`.
- `arcanum/_lib/spawn_issue.sh` (new) — the shared create+label+link script.
- `arcanum-split-issue/scripts/create_sub_issue.sh` — delegate create+label+link to `spawn_issue.sh --as-subissue`.
- `arcanum/migrations/repos/next/001.sh`, `001.md` (new), `arcanum/migrations/repos/next/migrations.json` — the label-sync migration.
- `enhance-issue/steps/dialogue.md`, `discuss-issue/steps/discuss_and_save.md` — note on calling `spawn_issue.sh`.
- `docs/agents/architecture/issue-tags.md` — document the new tag.

## CI Checks

- Repo root: `scripts/check_tags_table.sh` (CI job: `build-and-release`, tag-push only, non-blocking). Regenerates and diffs `docs/agents/tag-mutations.md` against `scripts/generate_tags_table.sh`'s output. This change is not expected to need a regeneration: `Spawned` is applied via a raw `gh issue edit --add-label` call inside `spawn_issue.sh` itself, not through a `mark-<x>`/`add-tag`/`remove-tag` verb in any skill's step `.md` file, which is the shape `generate_tags_table.sh` scans for. Worth a manual run of `scripts/generate_tags_table.sh` after Step 6 anyway, to confirm nothing unexpected changed.

## Notes

- `arcanum-split-issue/scripts/test_create_sub_issue_file.sh` covers `create_sub_issue_file.sh` (draft-file naming), not `create_sub_issue.sh` — unaffected by this refactor, no update needed.
- No existing regression test covers `create_sub_issue.sh`'s GitHub-creation/labeling behavior directly. Given the project's existing pattern of standalone `test_*.sh` regression scripts, consider adding one for `spawn_issue.sh`'s label-filtering (allow-list) logic specifically, since it's the most "pure function"-like, easily testable piece and the one with real security consequences (`shipit` must never leak through).
- The retry-after-actual-success duplicate-issue-creation risk (if `cmd_create`'s POST succeeds server-side but the client-side response is lost) is inherited from `create_sub_issue.sh`'s existing retry loop around `gh issue create` — not solved differently here, per the issue file's Edge Cases section.
