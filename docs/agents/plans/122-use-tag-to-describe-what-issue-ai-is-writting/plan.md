# Plan: use tag to describe what issue AI is writting

Issue: [122-use-tag-to-describe-what-issue-ai-is-writting.md](../../issues/122-use-tag-to-describe-what-issue-ai-is-writting.md)

## Overview

Add a new `Enhancing` label that marks an issue as actively being worked by `enhance-issue`'s AI-assisted dialogue, distinct from the passive `Idea`/`Writting` backlog state. `enhance-issue` adds it on fetch (removing `Idea`/`Writting`) and its existing `Created` transition on publish removes it again, so the tag is purely transient. This follows the same canonical-tag/label pattern already used for `created`/`refined`/`ready`/etc.

## Context

The `Writting` label currently means both "a human is drafting this" and "enhance-issue is actively enhancing this" — there's no way to distinguish the two from the issue list. The fix adds a new `enhancing`/`Enhancing` canonical tag, a `mark-enhancing` subcommand mirroring the existing `mark-created`/`mark-refined`/`mark-ready` pattern in `arcanum/_lib/github_issue.sh`, wires it into `enhance-issue`'s fetch step, extends `mark-created` to also strip `Enhancing` on publish, registers the label's default color in `init-claude`, and documents the new tag in the architecture doc. Scope is `enhance-issue` only — `discuss-issue` is untouched (see the issue's "Scope" section).

## Implementation Steps

### Step 1 — Register the `enhancing` canonical tag

In `arcanum/_lib/tags.sh`, add `enhancing` → `Enhancing` to the canonical-tag/label mapping table (the comment block), `_tag_label_for` (`enhancing) echo "Enhancing" ;;`), and `_tag_for_label` (`Enhancing) echo "enhancing" ;;`) — same shape as every other existing entry. No other function needs to change; `extract_tags`/`has_tag` already work generically off this table.

### Step 2 — Add the `mark-enhancing` subcommand

In `arcanum/_lib/github_issue.sh`:
- Add `cmd_mark_enhancing`, modeled directly on `cmd_mark_created`: adds `enhancing`, removes `idea` and `writting` (best-effort — a warning to stderr per failed mutation, never blocking, exactly like the existing `mark-*` commands).
- Wire it into the `case` dispatch (`mark-enhancing) shift; cmd_mark_enhancing "$@" ;;`) and both usage-comment blocks (the header comment and the `*)` fallback usage message), following the existing four-line pattern for each `mark-*` entry.

### Step 3 — Extend `mark-created` to also remove `Enhancing`

Still in `cmd_mark_created` (`arcanum/_lib/github_issue.sh`): add a `tag_mutate_remove_label "$id" "$repo_ref" enhancing` call (best-effort, same warning-on-failure pattern as the other two removals in that function), so the transient `Enhancing` tag never lingers past `enhance-issue`'s publish step. Update the function's usage-comment description ("Add the Created label and remove Idea/Writting, if present") to also mention `Enhancing`, in both places it appears (header comment and fallback usage message).

### Step 4 — Wire `mark-enhancing` into `enhance-issue`'s fetch step

In `enhance-issue/steps/fetch.md`, under the `### STATUS=ok` section: right after resolving `ID`/`TITLE`/`FILE`, before "Proceed straight to [explore.md](explore.md)", add a call to:
```bash
../scripts/github.sh mark-enhancing "$REPO_PATH" <id>
```
(reusing `enhance-issue`'s existing `github.sh` wrapper — the same one `publish.md` already uses for `mark-created`). Note inline that this runs unconditionally on every `STATUS=ok`, whether the draft was freshly fetched or resumed from an existing local file, and is best-effort (never blocks proceeding to `explore.md`), matching how `publish.md` already documents `mark-created`.

### Step 5 — Register the label's default color in `init-claude`

In `init-claude/scripts/lib/label_config.sh`, add `Enhancing:335ecc` to the `DEFAULT_LABEL_PAIRS` array, alongside the existing `Idea`/`Writting` entries. Per the issue, no retroactive sync path is needed for already-initialized repos — a repo picks up the new default the next time `init-claude` re-runs `label_config_ensure_defaults`/`sync_labels.sh` on it.

### Step 6 — Document the new tag in the architecture doc

In `docs/agents/architecture.md`'s "Issue Tags" section:
- Add a `| \`enhancing\` | \`Enhancing\` |` row to the canonical-tag/label table.
- Add a new paragraph (placed near the `idea`/`writting` paragraph, since it's the closest in lifecycle) explaining `enhancing`: applied by `arcanum/_lib/github_issue.sh`'s new `mark-enhancing` subcommand, called by `enhance-issue`'s fetch step as soon as an `Idea`/`Writting` issue is fetched for enhancement (removing `Idea`/`Writting`); removed again by the existing `mark-created` subcommand once `enhance-issue` publishes, alongside `Idea`/`Writting` — purely transient, scoped to `enhance-issue` only (`discuss-issue` does not use it).
- Update the existing `created` paragraph's description of `mark-created` ("adds `Created` and removes `Idea`/`Writting`, if present") to also mention it now removes `Enhancing`.

## Files to Change

- `arcanum/_lib/tags.sh` — add `enhancing`/`Enhancing` to the canonical-tag/label mapping.
- `arcanum/_lib/github_issue.sh` — add `cmd_mark_enhancing` + dispatch/usage wiring; extend `cmd_mark_created` to also remove `enhancing`.
- `enhance-issue/steps/fetch.md` — call `mark-enhancing` right after `STATUS=ok` is resolved.
- `init-claude/scripts/lib/label_config.sh` — add `Enhancing:335ecc` to `DEFAULT_LABEL_PAIRS`.
- `docs/agents/architecture.md` — document the new `enhancing` tag and update the `created`/`mark-created` description.

## Notes

- No CI job exercises these shell scripts or skill markdown (the only CircleCI job is the tag-triggered release build), so there's no `## CI Checks` section to add.
- `enhance-issue`'s own `scripts/github.sh` is already a thin wrapper delegating to `arcanum/_lib/github_issue.sh` — no changes needed there, only in the canonical lib it delegates to.
- `discuss-issue` reuses the same shared `resolve_and_fetch.sh`/`cmd_fetch` that `enhance-issue`'s fetch step calls — deliberately not touched, keeping this change scoped to `enhance-issue` only, per the issue's "Scope" section.
