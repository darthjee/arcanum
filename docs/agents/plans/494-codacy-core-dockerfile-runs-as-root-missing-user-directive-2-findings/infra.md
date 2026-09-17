# Infra Plan: Codacy: core/Dockerfile runs as root — missing USER directive (2 findings)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Suppress the two findings inline with documented rationale

Add inline suppression comments on the `ENTRYPOINT` (line 33) and `CMD` (line 34) lines of `core/Dockerfile`, targeting the two rule IDs from the Codacy findings:

- `Semgrep_dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` (line 33)
- `Semgrep_dockerfile.security.missing-user.missing-user` (line 34)

Use Semgrep/Opengrep's standard inline-suppression comment syntax (`# nosemgrep: <rule-id>`), placed directly above or on the flagged line per whichever placement Semgrep's Dockerfile analyzer actually respects. Immediately above the suppression comments, add a short explanatory comment (or extend the existing block comment above `ENTRYPOINT`) stating that `docker-entrypoint.sh` already starts as root only to fix mount-point ownership and drops to the `node` user via `su` before running `CMD` — pointing a future reader at `core/docker-entrypoint.sh` for the full rationale, rather than repeating it in full.

Do not add a `USER` directive to the Dockerfile — that would make `docker-entrypoint.sh` itself run as `node`, breaking its `chown -R node:node` calls against the root-owned `core_node_modules` volume and (when needed) the bind-mounted repo root.

### Step 2 — Verify locally and via Codacy's rescan

- Rebuild and run the image locally (`make core-test` from the repo root) to confirm the container still starts, `docker-entrypoint.sh` still successfully chowns the mount points and drops privileges to `node`, and `yarn test` still passes — i.e. the suppression comments are pure annotations with no behavioral effect.
- After pushing, confirm Codacy's next scan of the branch actually clears both findings. If the `# nosemgrep` syntax turns out not to be honored by Codacy's Opengrep integration for Dockerfiles (Codacy's own dismissal UI and inline `nosemgrep` comments are not guaranteed to be equivalent), fall back to dismissing the two findings directly in Codacy's SRM UI with the same rationale recorded in the dismissal reason, and note that limitation in a follow-up comment on issue #494.

## Files to Change

- `core/Dockerfile` — add inline suppression comments (with rationale) for the two Semgrep rule IDs on the `ENTRYPOINT`/`CMD` lines; no functional change.

## CI Checks

- `core/`: `make core-test` (also runs `yarn install --frozen-lockfile && yarn test` inside the built image via `core/docker-compose.yml`) — no dedicated CI job runs the Codacy/Opengrep IaC scan locally, so the suppression's actual effectiveness can only be confirmed via Codacy's own rescan after pushing.

## Notes

- Exact `nosemgrep` comment placement/syntax for Dockerfile-target rules should be verified empirically (Codacy's rescan on the PR) rather than assumed correct on first try.
- This is a documentation/suppression change only — no change to the container's actual runtime security posture, which already drops privileges to `node` before running `CMD`.
