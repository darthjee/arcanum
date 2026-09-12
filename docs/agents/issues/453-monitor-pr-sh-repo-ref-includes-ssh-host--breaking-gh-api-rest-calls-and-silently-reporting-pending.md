# monitor_pr.sh REPO_REF includes SSH host, breaking gh api REST calls and silently reporting pending

## Context

`auto-monitor-pr/scripts/monitor_pr_shell.sh` derives `REPO_REF` via `get_repo_ref` (from `arcanum/_lib/origin.sh`), which resolves it from the origin remote. For a remote like `ssh://git@ssh.github.com:443/darthjee/arcanum.git`, `get_repo_ref` returns `ssh.github.com/darthjee/arcanum` — the domain-plus-path form used when the origin's resolved domain isn't literally `github.com` (see `get_repo_ref`'s `github.com` special case in `arcanum/_lib/origin.sh`). Since the SSH proxy host is `ssh.github.com` rather than `github.com`, the value keeps the host prefix instead of collapsing to just `owner/repo`.

That value is used in two different ways in `monitor_pr_shell.sh`:

- `gh pr view "$PR_NUMBER" -R "$REPO_REF" ...` (line 161) — `gh` tolerates the host-prefixed form here and this call works fine.
- `gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments"` (line 195) — this builds a raw REST path, which expects `repos/{owner}/{repo}/...`. With the host prefix baked in, the call 404s. Verified live: `gh api repos/ssh.github.com/darthjee/arcanum/pulls/452/comments` → `{"message":"Not Found","documentation_url":"...","status":"404"}`.

The script wraps that `gh api` call in `|| { echo pending; exit 0; }`, so the 404 is swallowed silently and the script always reports `pending` for that PR — it never reaches the inline-comment fetch or the `:shipit:` exact-match detection logic that follows, even when a valid `:shipit:` PR comment already exists.

This was reproduced live on PR https://github.com/darthjee/arcanum/pull/452 (issue #448, using an SSH-proxy origin remote): a `:shipit:` PR comment was posted, then `auto-monitor-pr/scripts/monitor_pr.sh` was run (both directly and via `auto-monitor-issue-pr`) — it reported `pending` both times. The run only progressed once it instead used the issue's pre-existing `shipit` GitHub label to route through the separate pre-approval fast path in `auto-fix-all/steps/process_one_issue.md`, which doesn't depend on `monitor_pr.sh`'s REST call at all — masking the bug rather than exercising the fix.

`get_repo_ref` is used the same way (feeding both `gh pr view -R` and/or raw `gh api repos/...` REST paths) in several other scripts, so this may not be isolated to `monitor_pr_shell.sh`:

- `monitor-issues/scripts/monitor_issues.sh`
- `monitor-issues/scripts/github.sh`
- `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh`
- `auto-fix-issue/scripts/github_shell.sh`
- `auto-fix-all/scripts/github.sh`, `auto-fix-all/scripts/queue_common.sh`, `auto-fix-all/scripts/wait_ci_shell.sh`, `auto-fix-all/scripts/reply_comment_shell.sh`
- `init-claude/scripts/sync_labels.sh`

Each of these should be checked for whether it feeds `REPO_REF`/`repo_ref` into a raw `gh api repos/...` REST call (which needs a bare `owner/repo`) versus only into `-R`/`--repo` flags (which appear to tolerate the host-prefixed form).

## What needs to be done

- Add a dedicated helper to `arcanum/_lib/origin.sh` (e.g. `get_repo_slug` or similar) that always returns a bare `owner/repo` — stripping any host/proxy component — for use in raw REST (`gh api repos/{owner}/{repo}/...`) calls, distinct from `get_repo_ref`'s existing behavior (which remains suitable for `-R`/`--repo` flags).
- Update `auto-monitor-pr/scripts/monitor_pr_shell.sh`'s `gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments"` call (and any equivalent native Node.js implementation reachable via `engine_dispatch`, per `docs/agents/architecture/script-engine.md`) to use the new bare-slug helper instead of `REPO_REF`.
- Audit the other call sites listed above that use `get_repo_ref`/`repo_ref` and switch any that build raw `gh api repos/...` REST paths to the new helper too.
- Consider whether the silent `|| { echo pending; exit 0; }` fallback around the `gh api` call in `monitor_pr_shell.sh` should distinguish "PR genuinely has no reviewable state yet" from "the API call itself failed" (e.g. by logging the failure to stderr even while still exiting with `pending` for now), so that failures like this one aren't silently indistinguishable from a normal pending state during future debugging.
- Add or extend test coverage (e.g. alongside `arcanum/_lib/test_origin_resolution.sh`) for the new helper against an SSH-proxy-style origin (domain other than `github.com`), and for `monitor_pr_shell.sh`'s REST call succeeding under that origin shape.

## Acceptance criteria

- [ ] A helper exists in `arcanum/_lib/origin.sh` that returns a bare `owner/repo` regardless of the origin's resolved domain (including SSH-proxy hosts like `ssh.github.com`).
- [ ] `monitor_pr_shell.sh`'s `gh api repos/.../pulls/.../comments` call (and its native equivalent, if any) uses the bare-slug form and no longer 404s under an SSH-proxy-style origin.
- [ ] The other listed call sites that build raw `gh api repos/...` REST paths from `get_repo_ref`/`repo_ref` are audited and fixed where affected.
- [ ] Test coverage exists demonstrating correct REST-path resolution under an SSH-proxy-style origin (domain other than `github.com`).
