# Plan: Add new skill: enhance issue

Issue: [109-add-new-skill--enhance-issue.md](../issues/109-add-new-skill--enhance-issue.md)

## Overview

Add a new manual skill, `enhance-issue`, that runs an iterative, topic-driven dialogue with the user to flesh out a still-vague GitHub issue (typically tagged `Idea`/`Writting`) before it's mature enough for `discuss-issue` to take over. It reuses `discuss-issue`'s existing fetch/confirm building blocks rather than duplicating them, adds a new `docs/agents/issue-enhancement.md` "usual concerns" doc (seeded with defaults both in Arcanum itself and, via a new `init-claude` step, in any target project), and a new dedicated `mark-created` tag-mutation subcommand.

## Context

`discuss-issue` currently is the only skill that dialogues with a human about a GitHub issue, but it assumes the issue is already reasonably fleshed out (endpoints, permission rules, implementation ideas already sketched). `enhance-issue` targets the earlier, much vaguer stage — a one-liner idea — helping the user turn it into something concrete via a checklist of concerns (derived from the issue plus a project-level `docs/agents/issue-enhancement.md`), before publishing it back to GitHub as `Created`.

## Implementation Steps

### Step 1 — Add a `mark-created` tag subcommand

In `_lib/github_issue.sh`, add `cmd_mark_created`, structurally mirroring `cmd_mark_refined` (lines 233-250) but with different tag operations:
- `tag_mutate_add_label "$id" "$repo_ref" created`
- `tag_mutate_remove_label "$id" "$repo_ref" idea`
- `tag_mutate_remove_label "$id" "$repo_ref" writting`

Unlike `mark-refined`, it does **not** touch `refined` at all — this transition is `Idea`/`Writting` → `Created`, not `Created` → `Refined`. Register `mark-created` in the `case "${1:-}"` dispatcher and in the usage/help text at the bottom of the file, following the exact same shape as the existing `mark-refined`/`mark-ready` entries.

### Step 2 — Seed `docs/agents/issue-enhancement.md` (default content + Arcanum's own copy)

Draft a concise default list of "usual concerns" categories to check a fresh issue idea against, e.g.:
- Scope boundaries (what's explicitly in/out)
- Alternative solutions considered
- Edge cases
- Backward compatibility / breaking changes
- Testing strategy
- Performance & security considerations

Create Arcanum's own `docs/agents/issue-enhancement.md` with this content now (dogfooding, per the issue). Keep it short — a bullet list with a one-line description per category, not full prose.

### Step 3 — Extend `init-claude` to seed/customize the doc for target projects

- Extend `init-claude/scripts/setup_docs_structure.sh` to also create `docs/agents/issue-enhancement.md` (skipping if it already exists, same as the existing `architecture.md`/`flow.md` placeholders) seeded with the default list from Step 2.
- Add a new `init-claude/setup_issue_enhancement.md` step, modeled on `setup_architecture.md`'s draft → present → iterate → write pattern (not `setup_labels.md`'s JSON-config loop — this content is prose, not a structured table needing its own state file and mutation script): show the current seeded content, let the user add/remove/reword concern items in a loop, confirm, then write the file.
- Wire it into `init-claude/SKILL.md` as a new step after `setup_auto_fix_all_config.md` (currently the last step).

### Step 4 — New `enhance-issue` skill

Layout, mirroring `discuss-issue/`:

```
enhance-issue/
├── SKILL.md
├── scripts/
│   └── github.sh          (thin wrapper delegating to _lib/github_issue.sh, same shape as discuss-issue/scripts/github.sh)
└── steps/
    ├── fetch.md
    ├── explore.md
    ├── dialogue.md
    └── publish.md
```

Note: `enhance-issue` is interactive/manual, like `discuss-issue` and `plan-issue` — the two-layer "thin coordinator + spawned `architect` subagent" split described in `docs/agents/architecture.md`'s "Architect Delegation" section applies only to autonomous `auto-*` skills with no user interaction. It does **not** apply here; `SKILL.md` can narrate/chain the steps directly, same as `discuss-issue/SKILL.md` does.

Reuse rather than duplicate, per `docs/agents/architecture.md`'s "Cross-Skill References" convention:
- Fetching: call `../discuss-issue/scripts/resolve_and_fetch.sh docs/agents/issues "<args>"` directly — its "guarantee `FILE` exists on disk for any real, existing GitHub issue" contract holds regardless of the issue's current tags, so it fits `enhance-issue` as-is with no changes needed.
- Yes/no resolution: call `../discuss-issue/scripts/confirm.sh "<raw reply>"` directly instead of adding a second copy.

Step files:
- **`steps/fetch.md`** — resolve the id and fetch via the reused `resolve_and_fetch.sh` script (same interpretation rules as `discuss-issue/steps/extract_id_and_name.md`: `STATUS=ok` proceeds, `STATUS=error` asks the user for a numeric id and retries).
- **`steps/explore.md`** — a lightweight read of the issue content and any obviously-relevant code for general understanding. Explicitly lighter than `discuss-issue/steps/discuss_and_save.md`'s step 3 — no default specialist-agent dispatch, since the issue is expected to be vague at this stage.
- **`steps/dialogue.md`** — the core loop:
  1. Read `docs/agents/issue-enhancement.md` (if present in the target repo — degrade gracefully with just the issue-derived concerns if missing).
  2. Build/update a topic checklist: concerns from `issue-enhancement.md` plus anything issue-specific, marking items already discussed with a checkmark.
  3. Present the list, and let the user pick any item (checked or not) or introduce a new topic outside the list.
  4. For the chosen topic: dig in with the user, proposing alternatives, until both are satisfied; append the outcome to the local issue file (`FILE` from step 1).
  5. Return to step 2 until the user says they're satisfied overall.
- **`steps/publish.md`** — `scripts/github.sh update <id> "<title>" <file>`, then `scripts/github.sh mark-created <id>`, then delete the local `docs/agents/issues/<id>-...md` file — nothing from this skill is committed; only the live GitHub issue body/tags change (contrast with `discuss-issue`, which keeps and later commits its local file).

`SKILL.md` frontmatter: `name: enhance-issue`, description matching the issue's stated purpose, `Usage: /enhance-issue #19`. Body chains the four step files in order (fetch → explore → dialogue → publish), same structure as `discuss-issue/SKILL.md`.

### Step 5 — Update documentation

- `docs/agents/architecture.md`'s "Issue Tags" section: document `mark-created` alongside `mark-refined`/`mark-ready` (same paragraph style), noting it's called by `enhance-issue` and that it deliberately never touches `refined`/`ready`.
- Root `README.md`, if it lists skills: add an `enhance-issue` entry alongside `discuss-issue`'s.

## Files to Change

- `_lib/github_issue.sh` — add `mark-created` subcommand + dispatcher/usage entries.
- `docs/agents/issue-enhancement.md` — new, Arcanum's own seeded concerns doc.
- `init-claude/scripts/setup_docs_structure.sh` — seed `issue-enhancement.md` for target repos.
- `init-claude/setup_issue_enhancement.md` — new interactive step.
- `init-claude/SKILL.md` — wire in the new step.
- `enhance-issue/SKILL.md`, `enhance-issue/steps/fetch.md`, `enhance-issue/steps/explore.md`, `enhance-issue/steps/dialogue.md`, `enhance-issue/steps/publish.md`, `enhance-issue/scripts/github.sh` — new skill.
- `docs/agents/architecture.md`, `README.md` — doc updates.

## Notes

- The default seed list in Step 2 is a starting point (6 categories); the implementing agent should keep it concise and may adjust categories if the codebase/issue history suggests better ones — this isn't meant to be exhaustive.
- No new `.claude/state/*.json` file is needed for `enhance-issue`'s checklist — it's tracked only within the current conversation/local file, never persisted or resumed across runs (unlike `auto-fix-issue`'s per-issue state file).
- `mark-created` intentionally leaves `Refined`/`Ready` untouched — those transitions remain owned by `discuss-issue`'s own `mark-refined`/`mark-ready` calls, later in the pipeline.
