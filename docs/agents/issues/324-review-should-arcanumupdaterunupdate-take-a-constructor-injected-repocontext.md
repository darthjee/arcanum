# Issue: Review: should ArcanumUpdateRunUpdate take a constructor-injected RepoContext?

## Description

Review issue spun off from #308 (originally framed as the sub-issue-6 blocker
that #314 waited on). It decides whether `ArcanumUpdateRunUpdate`
(`arcanum-update-run-update-check`, `arcanum-update-run-update-apply`) should move
from `context: 'none'` to a constructor-injected `RepoContext` (or a
`ClaudeContext`-style bespoke collaborator), or be deliberately confirmed as
exempt.

The original "blocks #314" premise is now obsolete: #314 shipped (merged as #332)
on the per-command `context` enum, without ever making `RepoContext` construction
unconditional — the same situation that sibling review #322 (`AutoFixAllConfig`)
resolved as "no change". This issue is now a standalone on-its-merits review.

## Problem

- `check(repoPath)` / `apply(repoPath, ...)` take `repoPath` as a leading *method*
  argument rather than via a constructor-injected context, leaving them the last
  command shape inconsistent with the migrated families.
- That `repoPath` is the **arcanum install's own self-resolved directory** (where
  arcanum itself lives), not a target-project checkout. `RepoContext` models a
  *target repo* being worked on — `origin`, `githubToken`, `issueStateService`,
  `configChain`, `githubIssue` — so binding one to the arcanum install is a
  category mismatch, exactly as #322 found for a local-JSON command.
- `_parseGithubOwnerRepo` does call `git -C <repoPath> remote get-url origin`,
  which superficially overlaps `RepoContext` / `Origin`. The review must confirm
  that overlap is too thin to justify a shared abstraction.
- The exempt set is listed in `commands.js`'s top-of-file typedef comment, but
  without a per-command "why exempt" rationale for future readers.

## Expected Behavior

- `ArcanumUpdateRunUpdate` stays exempt: registry entries keep no `context` key,
  `Dispatcher` keeps `new ArcanumUpdateRunUpdate()` with untouched args, and
  `check` / `apply` keep their leading `repoPath` method argument.
- The rationale is recorded as a resolution comment on this issue (matching
  #322's precedent). `commands.js` is left untouched — no per-command exempt
  note added.
- No new abstraction is introduced for the arcanum-install git identity;
  `_parseGithubOwnerRepo` stays local to `ArcanumUpdateRunUpdate`.
- No `core/spec` behaviour change; no code change at all; suite stays green.

## Solution

- Walk `check` / `apply` / `_resolveTarget` / `_parseGithubOwnerRepo` /
  `_currentVersion` and confirm none would benefit from `RepoContext`'s
  target-repo collaborators (`githubToken`, `issueStateService`, `configChain`,
  `githubIssue`) or from `Origin#resolveWithRef`.
  - The single git touch (`_parseGithubOwnerRepo`) only needs `owner/repo`
    extracted from a github.com SSH/HTTPS remote with a `''` fallback, and only
    on the `git`-method branch (the `zip` branch reads `arcanum.json`). That is
    narrower than `Origin` / `RepoContext#resolve` and already self-contained —
    no shared abstraction warranted.
- Record the outcome as a resolution comment on this issue. Leave `commands.js`
  as-is — the exempt set is already listed in its top-of-file typedef comment;
  no per-command rationale line is added (same call as #322).
- No shared "arcanum-install git identity" abstraction, and no spin-off issue —
  the `_parseGithubOwnerRepo` / `Origin` overlap is too thin to act on.

## Benefits

- Closes the last open review gating full closure of the #308 exempt-list
  question.
- Keeps `RepoContext` scoped to its target-repo meaning instead of overloading it
  with "the arcanum install acting on itself".
- Documents why the `arcanum-update` commands intentionally diverge from the
  migrated command shape.
