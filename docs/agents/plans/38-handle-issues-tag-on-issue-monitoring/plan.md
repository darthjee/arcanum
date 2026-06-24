# Plan: Handle Issues Tag on Issue Monitoring

Issue: [38-handle-issues-tag-on-issue-monitoring.md](../issues/38-handle-issues-tag-on-issue-monitoring.md)

## Overview

`_lib/tags.sh` already centralizes tag *extraction* (`extract_tags`, `has_tag`), and `monitor-issues/scripts/monitor_issues.sh` already stores extracted tags into `.claude/state/issues.json`. What's missing — and what this issue is about — is the tag-to-**action** mapping: recognizing `❓`/`:question:`, `✏️`/`:pencil2:`, and `📋`/`:clipboard:` (in addition to the emoji form, not just the colon form) and dispatching the right behavior for each, centralized in a shared script rather than embedded ad hoc in `monitor_issues.sh`.

## Context

- `_lib/tags.sh` currently only matches the `:word:` colon form. The issue requires emoji forms too (`❓`, `✏️`, `📋`) to be recognized as equivalent to `:question:`, `:pencil2:`, `:clipboard:` respectively.
- `monitor_issues.sh` extracts tags and writes them to `issues.json` but takes no action based on which tags are present — issue 29 explicitly deferred "tag-based actions" to a follow-up, which is this issue.
- `:shipit:` is already implemented as a pre-approval signal consumed directly by `auto-fix-all` (`has_shipit_tag.sh`, `github.sh has-shipit-label`) — it is not processed by `monitor-issues` and is out of scope for the new dispatch logic; it's listed in the issue body only as a reference for the existing pattern.
- The three new tags need actions performed against the **live GitHub issue**, not just the local JSON cache, since `monitor-issues` only sees a snapshot — the script doing the dispatch needs to read the current issue body/labels from GitHub, perform the tag's action, then remove the tag from the GitHub issue body once handled.

## Implementation Steps

### Step 1 — Extend `_lib/tags.sh` to recognize emoji aliases

Add an alias map so each of the three new tags can be written either as `:word:` or as its emoji, normalizing emoji occurrences to the canonical `:word:` name before matching:

- `❓` → `question`
- `✏️` → `pencil2`
- `📋` → `clipboard`

`extract_tags` must return the canonical `:word:` name regardless of which form was used in the source text, so every downstream consumer (including the existing `has_tag`/`has_shipit_tag.sh`) keeps working unmodified. Keep this purely as a normalization step inside `extract_tags` — no new public function signature.

### Step 2 — Add a tag-action dispatch script

Create a new shared script (e.g. `_lib/tag_actions.sh` or a dedicated script under `monitor-issues/scripts/`, per the scripter's judgment on what's reusable vs. monitor-issues-specific) that, given an issue number/body, determines which of the three actionable tags are present and reports which action to take. Keep the actual side effects (rewriting the issue, pushing to the queue, answering a question) orchestrated from `monitor_issues.sh`/`monitor-issues/SKILL.md`, but keep the **mapping** (tag name → action identifier) in the shared script, per `docs/agents/architecture.md`'s "Script Preference" guidance.

Action semantics to support (per the issue body):
- `question` (❓): the issue has a question for the agent; once answered, the tag is removed from the GitHub issue body.
- `pencil2` (✏️): the issue is ready to be read and rewritten by the agent; tag removed after rewrite and the GitHub issue is updated (`gh issue edit` body update).
- `clipboard` (📋): the issue is ready to be pushed to the auto-fix queue; agent reads it, updates `issues.json`, and pushes the id via `push-issue-to-queue`'s queue script.

### Step 3 — Wire dispatch into `monitor-issues`

Update `monitor-issues/scripts/monitor_issues.sh` (and `monitor-issues/SKILL.md` if a new step needs architect-level reasoning, e.g. actually answering a `question` tag or rewriting the body for `pencil2`) so that after tags are stored in `issues.json`, any of the three actionable tags trigger the corresponding behavior. Removing a tag from the live GitHub issue body after handling it (`gh issue edit <id> --body ...`) should go through a script, not be improvised inline.

### Step 4 — Update tag for removal on GitHub

Add a script (or extend an existing `github.sh`-style script) that strips a single named tag out of an issue body's trailing `Tags:` line and pushes the updated body back via `gh issue edit`, leaving the rest of the body untouched — mirroring how `Tags:` blocks are already parsed/appended elsewhere (`auto-new-issue`'s `github.sh fetch`, `discuss-issue`'s `render_issue.sh`).

## Files to Change

- `_lib/tags.sh` — add emoji-to-canonical-name normalization inside `extract_tags`.
- `monitor-issues/scripts/monitor_issues.sh` — after storing tags, dispatch to the action mapping for any actionable tag found.
- New script(s) under `_lib/` or `monitor-issues/scripts/` — tag-to-action mapping and GitHub tag-removal helper (scripter to decide exact file placement and names).
- `monitor-issues/SKILL.md` — only if dispatching `question`/`pencil2` requires an architect-level step (reading the issue, answering, or rewriting) beyond what a script can do deterministically.
- `docs/agents/architecture.md` — update the "Issue Tags" section to document the three new tags and their actions, once implemented.

## Notes

- The `question`/`pencil2` actions inherently need AI judgment (answering a question, rewriting an issue body) — only the *detection* and *tag removal* parts are deterministic and belong in scripts; the actual content generation stays in markdown-driven architect reasoning, consistent with `docs/agents/architecture.md`'s script-preference guideline ("could this step produce a wrong result due to AI misinterpretation?").
- `clipboard` (push to queue) is fully deterministic and can be a pure script call into `push-issue-to-queue`'s existing queue script.
- Confirm with the scripter whether emoji characters round-trip safely through `grep -oE` given locale/encoding — may need `LC_ALL=C.UTF-8` or equivalent guard in `_lib/tags.sh`.
