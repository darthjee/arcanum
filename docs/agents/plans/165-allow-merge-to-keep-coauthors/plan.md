# Plan: Allow merge to keep coauthors

Issue: [165-allow-merge-to-keep-coauthors.md](../../issues/165-allow-merge-to-keep-coauthors.md)

## Overview

Make the squash-merge commit body configurable via a new `git.merge_body_mode`
key (`empty` / `full` / `coauthors`), resolved through the standard
local → repo → global config chain and defaulting to `"empty"` (today's exact
behavior). The mode-resolution and coauthor-generation logic lives in a new
shared `arcanum/_lib/merge_body.sh` helper, called from `cmd_pr_merge` in
`auto-fix-all/scripts/github.sh` — the only place `gh pr merge` is invoked in
the repo.

## Context

Today, `cmd_pr_merge` always runs:

```bash
gh pr merge "$number" -R "$repo_ref" --squash --delete-branch --subject "${title} (#${number})" --body "" >/dev/null
```

hardcoding an empty body and silently discarding any `Co-authored-by:`
trailers accumulated across the PR's commits. See the issue file for the
full design discussion (mode semantics, config chain, generation logic,
alternatives, and edge cases) — this plan implements those decisions as-is.

## Implementation Steps

### Step 1 — Document the new config key

Add a `git.merge_body_mode` row to the key table in
`docs/guides/arcanum-repo-config.md`, alongside the existing `git.email` and
`git.omit_model_coauthor` rows: type string (`empty`/`full`/`coauthors`),
default `empty`, chain local → repo → global, notes pointing at
`arcanum/_lib/merge_body.sh` and `cmd_pr_merge`.

### Step 2 — Create `arcanum/_lib/merge_body.sh`

New file, sourced (not executed), following `agent_email.sh`'s shape
(double-source guard, sources `config_chain.sh`). Exposes:

- `merge_body_mode()` — resolves `git.merge_body_mode` via
  `config_chain_read "." "git" "merge_body_mode"`. Validates the result
  against the known set (`empty`, `full`, `coauthors`); on empty/null/
  unrecognized values, print a warning to stderr and return `empty`
  (never abort).

- `merge_body_coauthors_list(repo_path, repo_ref, number)` — builds the
  deduped `Co-authored-by:` block for `coauthors` mode:
  1. `gh pr view "$number" -R "$repo_ref" --json commits -q '.commits[].authors[]'`
     to get the union of `{name, email, login}` triples across every
     commit (GitHub's own pre-parsed authors — no message-body
     regex/grep needed).
  2. Dedupe by `email` (skip entries with a null/missing email).
  3. Resolve the acting merger's login via `gh api user -q '.login'`
     (called after `_ensure_gh_user`, so it reflects the switched
     `git config user.ghuser` identity if one is set); drop any author
     entry whose `login` matches it. If this `gh api user` call fails for
     any reason, fail open — skip the exclusion step only, keep going
     with the full deduped list.
  4. Format each surviving entry as `Co-authored-by: ${name} <${email}>`.
  5. If `git.omit_model_coauthor` is `true` (via the existing
     `model_coauthor_omitted` in `agent_email.sh`), also drop the entry
     matching the model's own coauthor email — see Step 3 for how that
     email reaches this function.
  6. If the resulting list is empty, return an empty string (the caller
     treats this the same as "no custom body" — see Step 4).

### Step 3 — Thread the model's email through to `pr-merge`

`model_coauthor_omitted` alone only says *whether* to drop the model's
line — it doesn't say *which* email to match, since that's a per-call
argument (`MODEL_EMAIL`) in `commit_change.sh`, not a fixed constant.
Add an optional trailing `<model_email>` argument to `cmd_pr_merge` (and
its `pr-merge` CLI subcommand) in `auto-fix-all/scripts/github.sh`; when
given, pass it into `merge_body_coauthors_list` for the omission match in
Step 2.5. When omitted (the two existing callers below don't currently
have a model email in scope), skip that particular filter — the rest of
`coauthors` mode still works, this is a consistency nicety, not a
correctness requirement. Update the two call sites accordingly if a model
email is readily available there; otherwise leave them passing no value
for now and note it in `## Notes` below as a follow-up.

- `auto-fix-all/steps/process_one_issue.md` (`scripts/github.sh pr-merge "$REPO_PATH"`)
- `auto-fix-all/scripts/wait_ci_and_merge.sh` (`"${SCRIPT_DIR}/github.sh" pr-merge "$REPO_PATH"`) —
  keep this a purely additive, optional-argument change; it must stay the
  same single, distinctly-named invocation the permission classifier
  allowlists (see that script's own header comment).

### Step 4 — Wire the mode into `cmd_pr_merge`

Replace the hardcoded `--body ""` in `cmd_pr_merge`
(`auto-fix-all/scripts/github.sh`) with logic that sources
`arcanum/_lib/merge_body.sh` and branches on `merge_body_mode()`:

- `empty` → keep `--body ""` exactly as today.
- `full` → omit `--body` from the `gh pr merge` invocation entirely
  (`--subject` stays forced as today).
- `coauthors` → call `merge_body_coauthors_list`; if it returns a
  non-empty string, pass it via `--body`; if empty, fall back to `full`'s
  behavior (omit `--body`) rather than forcing an empty string — per the
  issue's edge-case decision.

### Step 5 — Manual verification

No automated test suite exists in this repo (pure markdown + bash
skills). Verify by hand against a real PR with multiple coauthored
commits:
1. Set `git.merge_body_mode` to `full` locally, run a merge, confirm
   `--body` is simply omitted from the `gh pr merge` call (inspect via a
   dry run / echo, not necessarily a real merge).
2. Set it to `coauthors`, confirm the generated `--body` lists the
   expected deduped `Co-authored-by:` lines and excludes the merger's own
   login.
3. Leave it unset, confirm `--body ""` is still used (no behavior change
   from before this issue).
4. Set it to an invalid value (e.g. `"bogus"`), confirm a stderr warning
   is printed and behavior falls back to `empty`.

## Files to Change

- `docs/guides/arcanum-repo-config.md` — add `git.merge_body_mode` to the
  key table.
- `arcanum/_lib/merge_body.sh` — new file: `merge_body_mode()` and
  `merge_body_coauthors_list()`.
- `auto-fix-all/scripts/github.sh` — `cmd_pr_merge`: source the new helper,
  branch on mode instead of hardcoding `--body ""`; extend the `pr-merge`
  subcommand's argument list with an optional `<model_email>`.
- `auto-fix-all/scripts/wait_ci_and_merge.sh` — pass through
  `<model_email>` if/when available at that call site (optional, additive).
- `auto-fix-all/steps/process_one_issue.md` — update the documented
  `pr-merge` invocation if a model email becomes available to thread
  through.

## Notes

- Whether `process_one_issue.md`'s and `wait_ci_and_merge.sh`'s call sites
  actually have a model email available in scope needs a closer look
  during implementation; if not, ship Steps 1–2 and 4–5 without the
  model-omission consistency piece (Step 3) and file a small follow-up
  rather than blocking this issue on it — `coauthors` mode still works
  correctly without it, just without the `git.omit_model_coauthor`
  cross-consistency.
- No CI job in `.circleci/config.yml` runs against skill/script changes
  on regular branches (it only triggers on release tag pushes), so there
  is no `## CI Checks` section for this plan.
