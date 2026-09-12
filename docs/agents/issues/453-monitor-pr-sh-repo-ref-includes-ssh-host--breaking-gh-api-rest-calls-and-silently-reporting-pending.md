# Issue: monitor_pr.sh REPO_REF includes SSH host, breaking gh api REST calls and silently reporting pending

## Description

`auto-monitor-pr/scripts/monitor_pr_shell.sh` derives `REPO_REF` via `get_repo_ref` (from `arcanum/_lib/origin.sh`), which resolves the origin remote into a domain-qualified reference: bare `owner/repo` when the resolved domain is literally `github.com`, or `domain/owner/repo` otherwise. For a remote like `ssh://git@ssh.github.com:443/darthjee/arcanum.git`, the SSH proxy host is `ssh.github.com` (not `github.com`), so `get_repo_ref` returns `ssh.github.com/darthjee/arcanum` instead of collapsing to `darthjee/arcanum`.

`origin.sh` already exposes a second helper, `get_repo_path`, that returns the bare `owner/repo` regardless of domain — it's already used correctly elsewhere (`auto-fix-all/scripts/wait_ci_shell.sh`, see Problem below).

`REPO_REF` is used two different ways in `monitor_pr_shell.sh`:

- `gh pr view "$PR_NUMBER" -R "$REPO_REF" ...` (line 161) — `gh` tolerates the host-prefixed form here; this call works fine.
- `gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments"` (line 195) — this builds a raw REST path, which expects `repos/{owner}/{repo}/...`. With the host prefix baked in, the call 404s.

## Problem

Verified live: `gh api repos/ssh.github.com/darthjee/arcanum/pulls/452/comments` → `{"message":"Not Found","documentation_url":"...","status":"404"}`.

The script wraps that `gh api` call in `|| { echo pending; exit 0; }`, so the 404 is swallowed silently and the script always reports `pending` for that PR — it never reaches the inline-comment fetch or the `:shipit:` exact-match detection logic that follows, even when a valid `:shipit:` PR comment already exists.

This was reproduced live on PR https://github.com/darthjee/arcanum/pull/452 (issue #448, using an SSH-proxy origin remote): a `:shipit:` PR comment was posted, then `auto-monitor-pr/scripts/monitor_pr.sh` was run (both directly and via `auto-monitor-issue-pr`) — it reported `pending` both times. The run only progressed once it instead used the issue's pre-existing `shipit` GitHub label to route through the separate pre-approval fast path in `auto-fix-all/steps/process_one_issue.md`, which doesn't depend on `monitor_pr.sh`'s REST call at all — masking the bug rather than exercising the fix.

A repo-wide search for `gh api repos/...` REST-path calls (`grep -rn "gh api" --include=*.sh .`) turns up exactly two such call sites in the whole codebase:

- `auto-monitor-pr/scripts/monitor_pr_shell.sh:195` — broken, as described above.
- `auto-fix-all/scripts/wait_ci_shell.sh:70` — already correct: it resolves `REPO_SLUG=$(get_repo_path "$REPO_PATH")` separately from `REPO_REF=$(get_repo_ref "$REPO_PATH")` and uses `REPO_SLUG` for the raw REST path.

Every other call site that consumes `get_repo_ref`/`repo_ref` (`monitor-issues/scripts/monitor_issues.sh`, `monitor-issues/scripts/github.sh`, `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh`, `auto-fix-issue/scripts/github_shell.sh`, `auto-fix-all/scripts/github.sh`, `auto-fix-all/scripts/queue_common.sh`, `auto-fix-all/scripts/reply_comment_shell.sh`, `init-claude/scripts/sync_labels.sh`) only ever passes it to `gh`'s `-R`/`--repo` flag, which tolerates the host-prefixed form — none of them build a raw REST path, so this bug is isolated to `monitor_pr_shell.sh`.

The native side is unaffected: `auto-monitor-pr/scripts/monitor_pr.sh` is already an `engine_dispatch` shim to `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js`, which calls `GitHubClient#getPrReviewComments()`; every REST URL in `core/lib/utils/github/GitHubClient.js` is built from the bare `repo` returned by `Origin#resolveWithRef()` (never the domain-qualified `repoRef`), so the native path never had this bug.

There is also no existing test coverage for the divergence this bug depends on: `arcanum/_lib/test_origin_resolution.sh` only exercises `ssh://git@github.com/...` origins (domain `github.com`), never an SSH-proxy-style origin (domain other than `github.com`) where `get_repo_ref` and `get_repo_path` actually diverge.

## Expected Behavior

- `monitor_pr_shell.sh`'s `gh api repos/.../pulls/.../comments` call resolves via the bare `owner/repo` form and no longer 404s under an SSH-proxy-style origin (domain other than `github.com`), letting the script reach its normal inline-comment/`:shipit:` detection logic instead of always falling back to `pending`.
- No new helper is added — `get_repo_path` in `arcanum/_lib/origin.sh` already does this job and is already proven correct via its existing use in `wait_ci_shell.sh`.
- No native-side change is needed — `AutoMonitorPrMonitorPr.js` / `GitHubClient.js` already build REST URLs from the bare repo.
- No other call site needs fixing — the repo-wide audit above found only one other raw REST-path call site (`wait_ci_shell.sh`), and it's already correct.
- A `gh api` failure on this call still results in `pending` (preserving the existing observable contract), but is now logged to stderr first, so it's distinguishable from a genuine "PR has no reviewable state yet" during future debugging.
- Test coverage exists for an SSH-proxy-style origin (domain other than `github.com`) demonstrating that `get_repo_ref` and `get_repo_path` resolve differently as expected, and that `monitor_pr_shell.sh`'s REST call succeeds under that origin shape.

## Solution

1. In `auto-monitor-pr/scripts/monitor_pr_shell.sh`, add `REPO_SLUG=$(get_repo_path "$REPO_PATH")` alongside the existing `REPO_REF=$(get_repo_ref "$REPO_PATH")` (mirroring `wait_ci_shell.sh`'s own pattern), and change line 195 from `gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments"` to `gh api "repos/${REPO_SLUG}/pulls/${PR_NUMBER}/comments"`. Leave `REPO_REF` as-is for the `gh pr view -R "$REPO_REF"` call on line 161, which tolerates the host-prefixed form.
2. Have the `gh api` call's failure branch (`|| { ... echo pending; exit 0; }`) log something to stderr (e.g. `echo "Warning: gh api repos/.../comments failed" >&2`) before still exiting with `pending`, so a REST failure isn't silently indistinguishable from a genuine pending state in logs.
3. Extend `arcanum/_lib/test_origin_resolution.sh` (or a sibling test file) with a fixture repo whose origin resolves to a domain other than `github.com` in the same shape as an SSH proxy host (e.g. `ssh://git@ssh.github.com:443/owner/repo.git`), asserting `get_repo_ref` returns the domain-prefixed form while `get_repo_path` returns the bare `owner/repo` for that same origin.
4. Add a test (shell-level, alongside `monitor_pr_shell.sh`'s existing coverage if any exists, or a new fixture-based test) exercising `monitor_pr_shell.sh`'s `gh api .../comments` call under that same SSH-proxy-style origin shape, confirming it resolves successfully instead of 404ing.

No new helper needs to be added to `origin.sh` — `get_repo_path` already exists and already returns a bare `owner/repo`. No other call site needs auditing further: the repo-wide `gh api repos/...` search in Problem above is exhaustive, and no native-side fix is needed since `GitHubClient.js` already uses the bare `repo`.

## Benefits

- Fixes a live bug where `monitor_pr.sh` (used by both `auto-monitor-pr` and `auto-monitor-issue-pr`) silently and incorrectly reports `pending` for any repo whose origin resolves through a non-`github.com` domain (e.g. an SSH proxy host), even when a valid `:shipit:` approval already exists — currently masked by falling back to the unrelated `shipit`-label fast path in `auto-fix-all`.
- Reuses an already-existing, already-tested helper (`get_repo_path`) instead of introducing a new one, keeping the fix minimal and low-risk.
- Closes a real test-coverage gap: the divergence between `get_repo_ref` and `get_repo_path` under an SSH-proxy-style origin was previously unverified.
- Makes future REST-path failures visible in stderr instead of silently indistinguishable from a normal pending state.
