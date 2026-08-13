# Plan: Document change of labels on issue

Issue: [139-document-change-of-labels-on-issue.md](../../issues/139-document-change-of-labels-on-issue.md)

## Overview

Add a generated, self-healing reference table (`docs/agents/tag-mutations.md`) listing every skill call site that mutates a GitHub issue tag, plus the tooling that keeps it accurate: a standalone generator script wired into `bump-version.sh`, a non-blocking CircleCI backstop that auto-files/dedups a GitHub issue when a release ships a stale table, and a new `Automated` label to support that dedup.

## Context

Tag-mutation behavior (`mark-*`/`add-tag`/`remove-tag` calls) is currently documented only as prose in `docs/agents/architecture.md`. That's fine for the "why" but slow for "which script do I edit." A hand-written table would go stale immediately, so the table is generated instead — on demand, and automatically at every release via `scripts/bump-version.sh` — with a CI-side check that never blocks a release but leaves a trail (a deduped, labeled GitHub issue) if the checked-in table and a fresh regeneration disagree.

Full design rationale (scope decisions, format, edge cases, security) lives in the issue file — this plan only breaks it into implementation steps.

## Implementation Steps

### Step 1 — Add the `Automated` label to the default label sync list

In `init-claude/scripts/lib/label_config.sh`, add `Automated:d93f0b` to `DEFAULT_LABEL_PAIRS` (alphabetical-ish position is not enforced by the existing list — append near the end, next to `auto-shipit`). This is the label the CI backstop attaches to auto-filed staleness issues; it's general-purpose, not scoped to this feature alone.

### Step 2 — Write the generator script

Create `scripts/generate_tags_table.sh`:
- Self-locates via `SCRIPT_DIR`/`REPO_ROOT` the same way `scripts/bump-version.sh` does — no `repo_path` argument (this script only ever analyzes arcanum's own skill folders).
- Walks every top-level skill folder, parses each skill's `SKILL.md` for `## Step N — ...` headings (mapping step file → step number), and scans each `steps/*.md` for invocation lines matching the full `<script-path> <verb> ...` pattern for `mark-*`, `add-tag`, and `remove-tag` — matches only inside fenced code blocks, never bare prose mentions (the concrete false positive to avoid: `auto-fix-issue/steps/open_pr.md`'s reference to Majora's unrelated `mark-ready`).
- For `mark-*` verbs, cross-references `arcanum/_lib/github_issue.sh`'s corresponding `cmd_mark_*` function body to resolve the actual tags added/removed. For `add-tag <tag>`/`remove-tag <tag>`, the tag is the literal argument.
- Loads `docs/agents/tag-mutations.review.json` if present (schema: `{"reviewed": [{"skill", "step_file", "match", "status": "ignored"|"confirmed", "reason"}]}`); treat a missing/empty file as `{"reviewed": []}`.
- **Default mode:** every matched candidate is included except ones recorded `status: ignored`. Writes the table to `docs/agents/tag-mutations.md`, grouped by skill and ordered by step, with an "auto-generated, do not edit by hand" header. `step` renders as `N (<file>.md)`, or just `(<file>.md)` when the skill has no step headings (e.g. `auto-rewrite-issue`).
- **`--review` mode:** verifies `/dev/tty` is open up front (fail fast to stderr with a clear message if not — never hang or fall back to chat-mediated prompts, per the `arcanum-migrate` convention in `arcanum/migrations/run.sh`). Lists only candidates not already present in `reviewed`, prompts `ignore`/`keep` per candidate via `/dev/tty`, appends each decision to the JSON, then writes the table the same as default mode.
- **`--help`:** usage text covering both modes.

### Step 3 — First run and initial triage

Run `scripts/generate_tags_table.sh --review` once to generate the first `docs/agents/tag-mutations.md` and `docs/agents/tag-mutations.review.json`, classifying the known Majora false positive as `ignored`. Commit both generated files as part of this change (not left for a future `bump-version.sh` run).

### Step 4 — Cross-link from `architecture.md`

In `docs/agents/architecture.md`'s tags section (near the existing `mark-*`/`enqueued`/`enhancing` prose), add one line pointing to the new table, e.g. "for the full per-skill call-site table, see `tag-mutations.md`."

### Step 5 — Wire into `bump-version.sh`

In `scripts/bump-version.sh`, add a call to `scripts/generate_tags_table.sh` (default, non-interactive mode) alongside its existing file-sync steps (version file, `bootstrap.sh`, `README.md`, migrations roll). No behavior change to its non-commit/non-tag/non-push contract.

### Step 6 — Write the CI backstop script

Create `scripts/check_tags_table.sh`:
- Regenerates the table to a temp path via `scripts/generate_tags_table.sh` (default mode) and diffs it against the checked-in `docs/agents/tag-mutations.md`.
- If `ARCANUM_SKIP_TAG_TABLE_CHECK` is set: print a **loud**, hard-to-miss notice that the check was skipped, exit 0.
- If it matches: exit 0, silent.
- If it mismatches: via `curl` + the job's `GH_TOKEN` (same REST-API convention as `scripts/upload_release_asset.sh`), `GET /repos/{owner}/{repo}/issues?labels=Automated&state=open`, filter by exact title match (`docs/agents/tag-mutations.md is out of date`) via `jq`. `PATCH` the existing issue's body (fresh diff + `$CIRCLE_BUILD_URL`) if found, else `POST` a new one with the `Automated` label. Print the skip-var instructions. **Exit 0 either way** — never fails the job.

### Step 7 — Add the CI step

In `.circleci/config.yml`'s `build-and-release` job, add a step calling `scripts/check_tags_table.sh` after checkout (order relative to the existing build/upload steps doesn't matter functionally, but placing it early surfaces the notice before the release artifacts are built).

### Step 8 — Regression tests

Create `scripts/test_generate_tags_table.sh`, following the standalone convention set by `arcanum/_lib/test_origin_resolution.sh` (plain bash, `fail()` helper, exit non-zero on failure, run by hand — not wired into CI). Uses small fixture skill folders (in a temp dir) to assert:
- A skill with `## Step N —` headings produces `N (<file>.md)` step values.
- A skill with no step headings (mirroring `auto-rewrite-issue`'s shape) produces `(<file>.md)`.
- A prose mention of a command name outside a fenced code block (mirroring `open_pr.md`'s Majora reference) is never matched.
- An entry marked `ignored` in `tag-mutations.review.json` is excluded from the generated table; an unclassified new entry still appears (fail-open).

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `Automated:d93f0b` to `DEFAULT_LABEL_PAIRS`.
- `scripts/generate_tags_table.sh` — new, the generator (default + `--review` + `--help`).
- `scripts/check_tags_table.sh` — new, the CI backstop.
- `scripts/test_generate_tags_table.sh` — new, regression tests.
- `scripts/bump-version.sh` — add the generator call as one more file-sync step.
- `.circleci/config.yml` — add the `check_tags_table.sh` step to `build-and-release`.
- `docs/agents/architecture.md` — add the one cross-link line.
- `docs/agents/tag-mutations.md` — new, generated output (committed from the initial run).
- `docs/agents/tag-mutations.review.json` — new, generated triage state (committed from the initial run).

## CI Checks

- `.circleci/config.yml`'s `build-and-release` job (tag-push only): local equivalent is running `scripts/check_tags_table.sh` directly (the `GET`/`PATCH`/`POST` calls need `GH_TOKEN` set to actually exercise the issue-filing path end to end; the diff-only portion runs without it).
- `bash scripts/test_generate_tags_table.sh` — regression tests, not part of any CI job (matches `arcanum/_lib/test_origin_resolution.sh`'s convention of being run by hand).

## Notes

- No `arcanum/migrations/repos/<version>/` entry needed — nothing here is a structural artifact copied into consuming repos except the new default label, which is picked up the normal way via `init-claude`'s label sync, not the migration system.
- Rollout dependency: this repo's real GitHub labels won't have `Automated` until `init-claude`'s label sync is re-run (or the label is created manually) — needs to happen once before Step 6/7's issue-filing path can succeed. Worth doing before or alongside merging this change.
- The `curl`+`GH_TOKEN` issue-filing path in `check_tags_table.sh` can only be fully exercised against real GitHub API state (CI or a manually-set `GH_TOKEN`); the regression tests in Step 8 cover the generator's parsing/table logic, not the network calls.
