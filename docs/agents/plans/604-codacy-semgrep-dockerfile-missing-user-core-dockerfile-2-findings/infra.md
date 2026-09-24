# Infra Plan: Codacy: Semgrep dockerfile missing-user — core/Dockerfile (2 findings)

Main plan: [plan.md](plan.md)

## Overview
Treat both findings as a documented false positive. Exclude `core/Dockerfile` from Codacy's Opengrep/Semgrep engine only, in `.codacy.yml`. Remove the `# nosemgrep:` comments that never worked and point the Dockerfile's rationale comment at `.codacy.yml`. No `USER` directive, no change to `core/docker-entrypoint.sh`, and no change to runtime behaviour.

## Context
- `core/docker-entrypoint.sh` must start as root to `chown` the root-owned `core_node_modules` named volume and, on Linux, the bind-mounted repo root. It then drops to `node` via `exec su node ...`. A `USER` directive would break those `chown` calls (the rationale is already documented in `core/Dockerfile` lines 27–33).
- #494 (PR #515) added `# nosemgrep: Semgrep_dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` and `# nosemgrep: Semgrep_dockerfile.security.missing-user.missing-user` above `ENTRYPOINT`/`CMD`. They use Codacy's display ids (with the `Semgrep_` prefix), not Semgrep's rule ids, so Codacy still reports both findings. The user chose configuration-based suppression over another inline attempt.
- `.codacy.yml` already has a top-level `exclude_paths` list, and a header comment block that explains each exclusion with its issue number (#460/#496, #498, #500, #509–#514). Follow that style.

## Implementation Steps

### Step 1 — Exclude core/Dockerfile from the Opengrep/Semgrep engine in `.codacy.yml`
Add an engine-scoped exclusion so only the Opengrep/Semgrep tool skips `core/Dockerfile`, while Hadolint and the other tools keep analysing it:

```yaml
engines:
  <engine-key>:
    exclude_paths:
      - "core/Dockerfile"
```

- Find the correct `<engine-key>` for the tool Codacy reports as **Opengrep** (whose patterns are prefixed `Semgrep_`). Check Codacy's documentation for `.codacy.yml` engine names (likely `semgrep` or `opengrep`). Record the source in the PR description.
- Keep the existing top-level `exclude_paths` list unchanged.
- Add a paragraph to the header comment block, in the same style as the others. It should say that Opengrep/Semgrep's `missing-user` / `missing-user-entrypoint` rules flag `core/Dockerfile` because there is no `USER` directive, that this is intentional (the entrypoint must start as root to `chown` the mount points, then drops to `node` via `su`; see `core/docker-entrypoint.sh`), and that inline `nosemgrep` suppression is not honoured by Codacy. Reference issues #494 and #604.
- **Fallback:** if Codacy's `.codacy.yml` does not support engine-scoped `exclude_paths` for this tool, add `"core/Dockerfile"` to the top-level `exclude_paths` instead. Say so explicitly in both the comment and the PR description, because it also hides the file from Hadolint.

### Step 2 — Clean up `core/Dockerfile` comments
- Remove the two `# nosemgrep: Semgrep_...` lines (currently lines 37 and 39) above `ENTRYPOINT` and `CMD`.
- Replace the last sentence of the block comment ("The findings below are suppressed accordingly.") with one saying that Semgrep's missing-USER findings for this file are suppressed in `.codacy.yml` (see #494/#604).
- Change no instructions. `ENTRYPOINT`, `CMD`, `COPY`, `RUN`, `WORKDIR` and `FROM` stay exactly as they are.

## Files to Change
- `.codacy.yml`: add an engine-scoped (or, as a fallback, top-level) exclusion of `core/Dockerfile`, plus a rationale comment.
- `core/Dockerfile`: remove the broken `nosemgrep` comments and update the rationale comment to point at `.codacy.yml`.

## CI Checks
- `core`: `make core-test` (CI job: `test`). Should be unaffected, but run it to confirm the image still builds and the suite passes.
- `core`: `make core-lint` (CI job: `checks`).

## Notes
- `.codacy.yml` is a root-level file, normally edited by `architect`. The change here only concerns `core/Dockerfile`, so it is bundled into this infra plan. The architect reviews it as coordinator.
- Codacy only re-analyses after a push. The findings disappearing can only be confirmed from the PR's Codacy run, not locally.
- Do not add `USER root`, `USER node`, or any privilege-handling change. The user explicitly chose configuration-only suppression.
