# pr-merge

The most complex subcommand. Read `auto-fix-all/scripts/github.sh`'s `cmd_pr_merge`, `arcanum/_lib/merge_body.sh`, and `arcanum/_lib/agent_email.sh` for the exact contract, and build on `ConfigChain.js` (Step 1).

- **`prMerge(repoPath, modelEmail)`**: current branch via `git branch --show-current`. If it matches `issue-<id>`, try `IssueState#get` for cached `pr_id`/`pr_url`; when both are cached, still fetch the PR title via REST (matches the shell's behavior of trusting the cache for number/url but re-fetching title). When not cached, fetch title/number/url via REST PR lookup in one call.
- **Body-mode resolution** (native re-derivation of `merge_body.sh`, built on `ConfigChain.js#read`):
  - `mergeBodyMode(repoPath)`: reads `engine`-style `git.merge_body_mode` via `ConfigChain#read(repoPath, 'git', 'merge_body_mode')`; one of `empty`/`full`/`coauthors`; unrecognized non-null value warns to stderr and falls back to `empty`; absent/null silently falls back to `empty`.
  - `empty` mode → merge with an empty body. `full` mode → omit body entirely (let GitHub's default squash body apply). `coauthors` mode → build the co-author block:
    - Fetch PR commits via `GET /repos/{repo}/pulls/{number}/commits` (each commit's `commit.author` for name/email, `.author.login` for the GitHub login — replaces `gh pr view --json commits`).
    - Resolve the merger's own login via `GET /user` (replaces `gh api user -q '.login'`); on failure, fail open (skip the merger-exclusion filter only, per the shell's documented behavior).
    - Dedupe by email (drop entries with null/empty email), drop the entry matching the merger's login, optionally drop the entry matching `modelEmail` (only when `modelEmail` is given AND `ConfigChain#read(repoPath, 'git', 'omit_model_coauthor')` is `true`), drop any entry whose email is in `ConfigChain#read(repoPath, 'git', 'remove_coauthors')` (default `[]`).
    - Empty resulting list → fall back to `full` mode's behavior (omit body).
- **Merge call**: `PUT /repos/{repo}/pulls/{number}/merge` with `merge_method: 'squash'`, `commit_title: "<title> (#<number>)"`, and `commit_message` set per the resolved body mode above (empty string / omitted / coauthors block). Failure → `Error: could not merge PR #<number> on <repo_ref>` to stderr, exit 1.
- **Branch deletion**: the shell's `gh pr merge --delete-branch` flag has no REST merge-endpoint equivalent — after a successful merge, issue an explicit `DELETE /repos/{repo}/git/refs/heads/<branch>`, tolerating "already deleted"/404 the same way `cleanupBranch`'s remote-delete already tolerates "not found". This is required for behavior parity and must not be skipped.
- On success, print the PR URL (matches the shell's final `echo "$url"`).

## Files to Change

- `core/lib/AutoFixAllGithub.js` — add `prMerge` plus private helpers for body-mode resolution and the coauthors list, built on `ConfigChain.js`.
