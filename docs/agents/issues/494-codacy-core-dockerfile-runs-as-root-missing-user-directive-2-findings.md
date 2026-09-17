# Issue: Codacy: core/Dockerfile runs as root — missing USER directive (2 findings)

## Description

Codacy's Opengrep (Semgrep) IaC scan flags `core/Dockerfile` twice for not specifying a `USER` before the container's entry point, so the scanner concludes the process runs as `root` inside the container.

**Source:** Codacy Security (SRM), scan type IaC, priority **High**, tool Opengrep.

In reality, `core/docker-entrypoint.sh` already starts as root only to `chown` mount points that Docker creates as root-owned (the `core_node_modules` named volume, and the bind-mounted repo root when host UID ownership does not match), then drops privileges to the `node` user via `su` before `exec`-ing `CMD`. So the *running* process is already non-root — the scan is a static check of the Dockerfile alone and cannot see the runtime privilege drop happening inside the entrypoint script.

## Problem

| File | Line | Pattern | Message |
|------|------|---------|---------|
| `core/Dockerfile` | 33 | `Semgrep_dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` | By not specifying a USER, a program in the container may run as 'root'. This is a security hazard. |
| `core/Dockerfile` | 34 | `Semgrep_dockerfile.security.missing-user.missing-user` | By not specifying a USER, a program in the container may run as 'root'. This is a security hazard. |

Adding a literal `USER node` directive before `ENTRYPOINT` (the fix the scanner's own wording implies) would make `docker-entrypoint.sh` itself start as `node` instead of `root`, breaking its `chown -R node:node` calls against the root-owned volume/bind-mount paths — i.e. it would silence the finding but break the container at startup.

## Expected Behavior

- The two Codacy findings are durably dismissed as false positives, with the rationale documented in `core/Dockerfile` itself (not just resolved silently in the Codacy UI, which would not survive a rescan or explain the decision to a future reader).
- `core/docker-entrypoint.sh` still successfully fixes ownership of the `core_node_modules` volume and, when needed, the bind-mounted repo root — i.e. the root-start-then-drop-privileges behavior it relies on is not broken or reduced in scope.
- `yarn test` (and the future `engine.mode=docker` execution path this same image backs — see `docs/agents/architecture/script-engine.md`) still runs correctly as the non-root `node` user.

## Solution

Dismiss the two findings as false positives rather than adding a `USER` directive that would break `docker-entrypoint.sh`'s intentional root-start:

- Add inline suppression comments on `core/Dockerfile` lines 33/34 (`ENTRYPOINT`/`CMD`) for the two rule IDs (`dockerfile.security.missing-user-entrypoint`, `dockerfile.security.missing-user`), using whichever suppression syntax Opengrep/Semgrep's Dockerfile analyzer actually honors (e.g. a `# nosemgrep: <rule-id>` comment) — verify Codacy actually clears the finding after a rescan, since Codacy's SRM dismissal UI and inline `nosemgrep` comments are not guaranteed to be equivalent.
- Reference `core/docker-entrypoint.sh`'s existing explanatory comment (root-start-then-drop-privileges via `su`) as the rationale, so the suppression is self-documenting rather than a bare ignore.
- If inline suppression turns out not to be supported/effective for this Codacy/Opengrep rule on Dockerfiles, fall back to dismissing the two findings directly in the Codacy SRM UI with the same rationale recorded in the dismissal reason, and note that limitation in this issue for future reference.

## Benefits

- Clears two High-priority Codacy IaC findings without weakening the container's actual security posture or breaking the volume/bind-mount ownership fix `core/docker-entrypoint.sh` depends on.
- Documents, in the codebase, why this Dockerfile intentionally has no build-time `USER` directive — preventing a future contributor (or agent) from "fixing" this the naive way and breaking container startup.
