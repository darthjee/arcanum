# Issue: Allow merge to keep coauthors

## Description

Today, `auto-fix-all`'s PR-merge step (`cmd_pr_merge` in
`auto-fix-all/scripts/github.sh`) always squash-merges the current branch's
PR with a hardcoded empty commit body:

```bash
gh pr merge "$number" -R "$repo_ref" --squash --delete-branch --subject "${title} (#${number})" --body "" >/dev/null
```

This discards any `Co-authored-by:` trailers that accumulated across the
PR's individual commits (e.g. the model's own line, or other agents'
lines added per the existing `git.omit_model_coauthor` config), and gives
no way to opt into GitHub's own default squash body either.

## Problem

There is only one merge-body behavior today, and it is lossy: co-authorship
information that individual commits carry is silently dropped when the PR
gets squash-merged, with no configuration to change that.

## Expected Behavior

A new `git.merge_body_mode` config key controls the squash-merge body,
resolved through the standard `config_chain_read` order (local state →
repo config → global user config → hardcoded default `"empty"`, matching
today's behavior with zero change for repos that do not opt in):

- **`empty`** (default, today's behavior) — `--body ""`.
- **`full`** — omit `--body` entirely so GitHub/`gh` picks its own default
  squash body. `--subject "${title} (#${number})"` is still always passed
  as today; only the body is affected by this mode.
- **`coauthors`** — `--body` is built from the deduped
  `Co-authored-by: Name <email>` trailer lines found across the PR's
  commits (bare trailer lines only, no extra header text, so GitHub still
  recognizes them as coauthors on the merge commit).

## Solution

**Coauthor-list generation** — source data from
`gh pr view <number> -R <repo_ref> --json commits`. GitHub pre-parses each
commit's `authors[]` (name + email + login), combining the actual git
author with anyone tagged via a `Co-authored-by:` trailer, so no raw
message-body parsing/regex is needed. Take the union of `authors[]` across
every commit, deduped by `email`. Exclude the identity performing the
merge itself: after `_ensure_gh_user` runs, resolve its GitHub login via
`gh api user -q '.login'` and drop any author entry whose `login` matches
it (that identity becomes the squash commit's own git author already, so
listing it again would be redundant) — match by `login` rather than
`email` since email may be private. `coauthors` mode also respects the
existing `git.omit_model_coauthor` config (`arcanum/_lib/agent_email.sh`):
when that's `true`, the model's own `Co-authored-by` line is additionally
dropped from the generated list too, for consistency with how it's
already excluded from individual commits.

**Where the logic lives** — entirely in the merge step, not the commit
scripts (`commit_change.sh`/`commit_issue.sh`/`commit_plan.sh` already
handle per-commit trailers separately via `git.omit_model_coauthor` and are
untouched by this change). `cmd_pr_merge` in
`auto-fix-all/scripts/github.sh` is the only call site for `gh pr merge` in
the repo today. Following the precedent set by `arcanum/_lib/agent_email.sh`
(which resolves `git.omit_model_coauthor` outside of the calling scripts),
a new shared helper — e.g. `arcanum/_lib/merge_body.sh` — resolves
`git.merge_body_mode` and returns the right `--body` value; `cmd_pr_merge`
sources it and calls that function instead of hardcoding `--body ""`.

**Config key**: `git.merge_body_mode`, a string with value `"empty"` /
`"full"` / `"coauthors"`, same namespace/style and 3-tier chain as the
existing `git.email` and `git.omit_model_coauthor` keys. Documented in
`docs/guides/arcanum-repo-config.md`'s key table alongside them.

**No init-claude step, no migration.** The closest precedent,
`git.omit_model_coauthor` (#164/#173), shipped with neither — purely
opt-in and documented only. `git.email` gets interactive setup, but via an
`arcanum-migrate` migration script, specifically because it needs a
per-user guessed default from `git config user.email`, which
`git.merge_body_mode` has no equivalent of. Defaulting to `"empty"` means
there is nothing existing repos need to catch up on, so a migration would
have nothing meaningful to do.

**Alternatives considered**:
- Relying on GitHub's own default squash body instead of a distinct
  `coauthors` mode — rejected/deferred: unverified whether `full` mode's
  default already surfaces coauthors, and even if it does, `coauthors`
  stays as its own explicit, deterministic path rather than depending on
  GitHub's undocumented/changeable default heuristic.
- Two composable booleans (mirroring `git.omit_model_coauthor`'s style)
  instead of one string enum — rejected: the three modes are mutually
  exclusive, and a boolean pair can represent invalid states (both `true`
  at once) a single enum cannot.

**Edge cases**:
- Empty coauthors list (solo-author PR, or every author excluded as the
  merger) → falls back to `full` mode's behavior (omit `--body`), not to
  an empty string.
- Unrecognized `git.merge_body_mode` value (e.g. a typo) → warn to stderr,
  fall back to the hardcoded default (`"empty"`); never hard-abort an
  autonomous run over a config typo.
- Merger-login lookup failure (`gh api user -q '.login'` errors) → fail
  open, skip the exclusion step only, proceed with the merge.
- `gh pr view --json commits` entries with a null/missing `email` → skip
  that author entry.
- Non-squash merges are out of scope; `cmd_pr_merge` only ever performs
  `--squash` merges today.

## Benefits

- Preserves co-authorship attribution on squash-merge commits when a repo
  opts in, instead of always discarding it.
- Fully backward compatible — default `"empty"` mode keeps today's exact
  behavior for every repo that does not explicitly opt in.
- Reuses the already-established `git.*` config-chain pattern
  (local → repo → global), keeping configuration consistent with
  `git.email`/`git.omit_model_coauthor` rather than introducing a new
  mechanism.
- No extra onboarding friction — no init-claude prompt or migration
  required to adopt or ignore this feature.
