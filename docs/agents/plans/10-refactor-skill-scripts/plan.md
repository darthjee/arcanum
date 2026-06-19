# Plan: Refactor skill scripts

Issue: [10-refactor-skill-scripts.md](../../issues/10-refactor-skill-scripts.md)

## Overview

Address the one place where script duplication is real and avoidable without breaking this repo's established self-containment convention: `auto-fix-all/scripts/github.sh`, `monitor_pr.sh`, and `wait_ci.sh` (3 scripts in the *same* skill) each duplicate the same ~30-40 line origin-resolution helper block. Extract it into a single sourced file within that skill. Leave cross-skill duplication (e.g. `new-issue` vs `auto-new-issue`'s near-identical `github.sh`) untouched and explicitly documented as intentional. Also split the tag-block extraction logic in `github.sh`'s `cmd_fetch` (added for issue #11) into named helper functions for clarity.

## Context

- Confirmed via `grep`/`wc -l`: `auto-fix-all/scripts/github.sh` (164 lines), `monitor_pr.sh` (210 lines), and `wait_ci.sh` (127 lines) each contain their own copy of `_load_origin`, `get_repo_ref`, `get_gh_user`, `_ensure_gh_user` (and `github.sh` additionally has `get_domain`/`get_repo_path`/`get_github_token`/`normalize_title`/`get_gh_user`). This is the only skill where *multiple scripts in the same folder* duplicate this block — every other skill (`new-issue`, `auto-new-issue`, `auto-fix-issue`) has exactly one script that needs these helpers, so there's nothing to deduplicate *within* those skills.
- Cross-skill duplication (e.g. `new-issue/scripts/github.sh` vs `auto-new-issue/scripts/github.sh`, kept deliberately byte-identical; or the conceptually similar-but-different `auto-fix-issue/scripts/github.sh`) is a documented, intentional tradeoff in this repo: each skill folder is self-contained, with no `source`-ing across skill boundaries (see existing comments like "Duplicated verbatim from github.sh: self-contained script, no sourcing across scripts" in `monitor_pr.sh`/`wait_ci.sh`). This plan keeps that boundary — it only deduplicates *within* `auto-fix-all`, where sourcing a sibling file in the same skill folder doesn't violate cross-skill self-containment.
- `github.sh`'s `cmd_fetch` (in both `new-issue` and `auto-new-issue` copies) currently inlines the tag-block detection (`perl -0777 -ne ...`) and stripping (`perl -0777 -pe ...`) directly inside the function body, alongside the GitHub API call and file-writing logic — three distinct concerns in one function.

## Implementation Steps

### Step 1 — Extract `auto-fix-all/scripts/_lib_origin.sh`

Create a new file containing exactly the origin-resolution block currently duplicated three times: `_ORIGIN_PARSED`/`_ORIGIN_DOMAIN`/`_ORIGIN_REPO_PATH` globals, `_load_origin`, `get_repo_ref`, `get_gh_user`, `_ensure_gh_user`. (Leave `github.sh`-only helpers — `get_domain`, `get_repo_path`, `get_github_token`, `normalize_title` — out of this shared file if they're not used by `monitor_pr.sh`/`wait_ci.sh`; verify which functions each of the three files actually calls before deciding the exact shared set, and only extract what's genuinely common to all three.)

This file is sourced, not executed standalone — name it with a leading underscore (`_lib_origin.sh`) so it's clearly not a CLI entry point, consistent with no other script in this repo being a sourced-only file (this is a new pattern for this repo; document it with a header comment explaining it's meant to be sourced, not run directly).

### Step 2 — Source it from the three scripts

In `github.sh`, `monitor_pr.sh`, and `wait_ci.sh`, replace the inlined helper block with:
```bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib_origin.sh"
```
(resolving relative to the script's own directory so it works regardless of caller's cwd — same pattern already used elsewhere in this repo for relative script resolution, e.g. `init-claude/scripts/setup_templates.sh`'s `script_dir` resolution). Verify behavior is unchanged by re-running the manual tests already used to validate these three scripts during issues #5, #9, and #12 (e.g. `monitor_pr.sh monitor <id>` against a real branch/PR, `wait_ci.sh` against a real PR, `github.sh pr-number`/`has-shipit-label`/`pr-merge` against real data).

### Step 2b — Document the self-containment boundary

Add a short note (in this plan and, if it doesn't already exist, as a comment in `_lib_origin.sh`) that this sourcing is scoped to *within* `auto-fix-all` only — other skills keep their own independent copies of similar helpers by design, since each skill folder must remain self-contained and portable on its own.

### Step 3 — Split `cmd_fetch`'s tag-handling into named functions

In both `new-issue/scripts/github.sh` and `auto-new-issue/scripts/github.sh` (kept byte-identical), extract two functions from `cmd_fetch`'s body:
- `extract_tags_block <body>` — returns the matched tags block (or empty if none), using the existing perl detection regex.
- `strip_tags_block <body>` — returns `body` with the trailing tags block removed (or `body` unchanged if none), using the existing perl stripping regex.

`cmd_fetch` then calls these two functions instead of inlining the perl one-liners, with no behavior change. Re-run the test cases already used for issue #11 (with/without tags block, whitespace-only blank lines, case-insensitive `tags:`) to confirm identical output.

### Step 4 — Sweep

Confirm no other script in the repo has the same kind of *intra-skill* duplication (multiple scripts in one skill folder repeating the same block) — `new-issue`, `auto-new-issue`, `auto-fix-issue`, `plan-issue`, `init-claude` each have at most one script needing these helpers, already checked.

## Files to Change

- `auto-fix-all/scripts/_lib_origin.sh` (new)
- `auto-fix-all/scripts/github.sh`
- `auto-fix-all/scripts/monitor_pr.sh`
- `auto-fix-all/scripts/wait_ci.sh`
- `new-issue/scripts/github.sh`
- `auto-new-issue/scripts/github.sh`

## Notes

- No CI config exists in this repo; verification is manual re-testing of the affected scripts' existing behavior (no functional change intended).
- This is entirely script work — should go through the `scripter` agent per this repo's convention; nothing here requires architect-level prose changes beyond this plan itself.
- Acceptance criterion "documented decision on origin-resolution duplication" is satisfied by Step 2b plus this plan/issue's own write-up.
