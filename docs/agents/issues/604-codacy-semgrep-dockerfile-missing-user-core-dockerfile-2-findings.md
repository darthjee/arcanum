# Issue: Codacy: Semgrep dockerfile missing-user — core/Dockerfile (2 findings)

## Description

Codacy (tool **Opengrep**, category Security, severity **High**) still reports two Semgrep findings on `core/Dockerfile`. `ENTRYPOINT` and `CMD` have no `USER` directive before them, so the rule assumes the container may run as root. These are the only **High** severity findings in the repo.

- `core/Dockerfile:38`: `ENTRYPOINT ["docker-entrypoint.sh"]`. Pattern `Semgrep_dockerfile.security.missing-user-entrypoint.missing-user-entrypoint`.
- `core/Dockerfile:40`: `CMD ["sh", "-c", "yarn install --frozen-lockfile && yarn test"]`. Pattern `Semgrep_dockerfile.security.missing-user.missing-user`.

_Source: Codacy API snapshot taken on 2026-09-24 (commit `20f71a3`). One of a batch of about 30 issues covering the worst open Codacy findings._

## Problem

This is the second attempt at these findings. #494 (PR #515) chose not to add a `USER` directive, for a real reason. `core/docker-entrypoint.sh` has to start as root so it can `chown` two things: the root-owned `core_node_modules` named volume and, on Linux, the bind-mounted repo root. It then drops to `node` with `exec su node ...`. #515 added `# nosemgrep:` comments on the line above each flagged instruction instead. Those comments used Codacy's display ids, which carry a `Semgrep_` prefix, rather than Semgrep's own rule ids (`dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` / `dockerfile.security.missing-user.missing-user`). Codacy therefore still reports both findings.

Codacy only re-analyses after a push, so the result of any inline-suppression fix can't be confirmed before the PR runs. It is also not proven that Codacy's Opengrep wrapper honours `nosemgrep` at all.

## Expected Behavior

- Codacy reports zero Semgrep `missing-user` / `missing-user-entrypoint` findings for `core/Dockerfile`.
- Runtime behaviour is unchanged. The container starts as root, the entrypoint's `chown` calls still work, and the CMD still runs as `node`.
- `make core-test` (and the other `core-*` targets) still pass.
- The fix creates no new High/Security finding from another Codacy tool (e.g. Hadolint).

## Solution

Treat both findings as a documented false positive and silence them through Codacy configuration, not inline comments:

1. In `.codacy.yml`, exclude `core/Dockerfile` from the **Opengrep/Semgrep engine only** (an engine-scoped `exclude_paths` under `engines:`), so other Codacy tools (e.g. Hadolint) keep analysing the file. Add a rationale comment in the file's existing style: the entrypoint must start as root to `chown` the volumes, then drops to `node` via `su`. Reference #494 and #604.
   - Check the engine key Codacy uses for this tool (Opengrep vs. Semgrep). If Codacy doesn't support engine-scoped exclusion for it, say so in the PR and fall back to excluding the file in the top-level `exclude_paths`.
2. In `core/Dockerfile`, remove the two broken `# nosemgrep: Semgrep_...` comments. Update the block comment so it points at `.codacy.yml` as the place the finding is suppressed, rather than at inline suppression.
3. Leave `core/docker-entrypoint.sh` and runtime behaviour untouched. No `USER` directive and no non-root refactor.

Ownership: `.codacy.yml` is a root-level file, so it belongs to `architect`. The `core/Dockerfile` comment cleanup belongs to `infra`.

## Benefits

- Clears the only High severity finding in the repo.
- Keeps the documented entrypoint privilege-drop design, and the suppression or config change actually works this time.
