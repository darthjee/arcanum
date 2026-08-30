# Plan: Review: should ArcanumUpdateRunUpdate take a constructor-injected RepoContext?

Issue: [324-review-should-arcanumupdaterunupdate-take-a-constructor-injected-repocontext.md](../issues/324-review-should-arcanumupdaterunupdate-take-a-constructor-injected-repocontext.md)

## Overview

This is a review/decision issue, not an implementation issue. The outcome —
already agreed in discussion and matching the sibling review #322
(`AutoFixAllConfig`) — is that `ArcanumUpdateRunUpdate` **stays exempt**: no
`context` key in the registry, `new ArcanumUpdateRunUpdate()` with untouched
args, and `repoPath` stays a leading method argument. The only deliverable is a
resolution comment on GitHub issue #324 recording the rationale. No source
changes, no `commands.js` edit, no spin-off issue.

## Context

- `#308` spun off per-command reviews (#321–#324) for the commands treated as
  exempt from the `takesRepoContext` / unconditional-`RepoContext` plan.
- `#314` has already shipped (merged as #332) on the per-command `context` enum,
  without making `RepoContext` construction unconditional — so #324's original
  "blocks #314" framing is moot. #322 resolved the analogous question for
  `AutoFixAllConfig` as "no change".
- `core/lib/commands/ArcanumUpdateRunUpdate.js`: `check(repoPath)` /
  `apply(repoPath)` take `repoPath` as the **arcanum install's own
  self-resolved directory** (where arcanum itself lives), not a target-project
  checkout. Constructor injects only process helpers (`execFileAsync`,
  `spawnFn`, `readFile`, `existsSync`).
- `core/lib/context/RepoContext.js` models a *target repo* being worked on —
  it bundles `origin`, `githubToken`, `issueStateService`, `configChain`,
  `githubIssue` and owns `repoPath` validation (present / directory / git
  repo). Binding one to the arcanum install is a category mismatch.
- `core/lib/core/commands.js`: `arcanum-update-run-update-check` /
  `arcanum-update-run-update-apply` already carry no `context` key, and the
  top-of-file typedef comment already lists `arcanum-update-run-update-*` under
  the `'none'` / absent case. `core/lib/core/dispatcher.js` therefore already
  does `new ArcanumUpdateRunUpdate()` with `commandArgs()` returning the full
  `this.args` (no leading strip).

## Implementation Steps

### Step 1 — Confirm the review conclusion against the code

Re-read `core/lib/commands/ArcanumUpdateRunUpdate.js` end to end and confirm
none of `check` / `apply` / `_resolveTarget` / `_readRepoFromArcanumJson` /
`_parseGithubOwnerRepo` / `_currentVersion` / `_runBootstrap` would benefit
from a constructor-injected `RepoContext` (or `ClaudeContext`):

- The only git touch is `_parseGithubOwnerRepo`, which runs
  `git -C <repoPath> remote get-url origin` and extracts `owner/repo` from the
  github.com SSH/HTTPS forms with a `''` fallback — and only on the `git`
  method branch (the `zip` branch reads `arcanum.json`). This is narrower than
  `Origin` / `RepoContext#resolve` (no domain, no `repoRef`) and fully
  self-contained. Too thin to justify a shared abstraction.
- `RepoContext`'s other collaborators — `githubToken`, `issueStateService`,
  `configChain`, `githubIssue` — model target-repo / issue-workflow concerns
  that have no meaning for "the arcanum install updating itself". None are
  wanted here.
- `repoPath` here is arcanum's own resolved install root, not a checkout to
  validate with `RepoContext#validate()` (present / directory / git-repo). The
  command already fails with its own `STATUS=missing_arcanum` contract when
  `arcanum/update/bootstrap.sh` or `arcanum.json`/`.git` is absent.

Conclusion: stays exempt; `context: 'none'` (absent) is the correct marker;
`check` / `apply` keep the leading `repoPath` method argument. No code change.

### Step 2 — Post the resolution comment on issue #324

Add a comment to GitHub issue #324 (via `gh issue comment 324 --repo
darthjee/arcanum`), in the same "Review concluded — no change" shape #322
used. It should state:

- Decision: keep `context: 'none'`; `ArcanumUpdateRunUpdate` stays as-is.
- Why: the original premise (blocking #314's "make `RepoContext` construction
  unconditional" plan) was obsoleted by the per-command `context` enum and
  #314 shipping without it. On its own merits, `repoPath` is the arcanum
  install's own path (not a target repo), so `RepoContext` — a
  git/GitHub/issue bundle — is the wrong abstraction; the single
  `git remote get-url origin` call in `_parseGithubOwnerRepo` is too narrow to
  warrant extracting a shared "arcanum-install git identity" helper.
- No `commands.js` change (the exempt set is already documented in its
  top-of-file typedef comment). No spin-off issue filed.

Then close the issue (or leave the label handling to the normal pipeline —
the PR that merges this plan carries `Fix #324`).

## CI Checks

No `core/` source or spec files change, so the `test` (`yarn test`) and
`checks` (`yarn lint`) CircleCI jobs have nothing new to exercise. Only docs
files under `docs/agents/` are added.

- `core`: `yarn test` (CI job: `test`) — unaffected; no code change.
- `core`: `yarn lint` (CI job: `checks`) — unaffected; no code change.

## Notes

- This mirrors #322's resolution exactly (review → "no change" → comment).
  There is no `docs/agents/plans/322-*` directory; #322 was resolved without a
  formal plan. This plan exists only because planning was explicitly requested.
- If a future second consumer appears that needs the arcanum install's git
  identity, revisit whether a small dedicated helper (not `RepoContext`) is
  worth extracting — explicitly out of scope here.
- Owner: `architect`. No specialist agent has implementation work — the issue
  is a decision plus a GitHub comment, with zero source changes.
