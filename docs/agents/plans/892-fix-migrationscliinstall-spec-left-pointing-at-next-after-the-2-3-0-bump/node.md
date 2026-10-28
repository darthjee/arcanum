# Plan: Fix migrationsCliInstall spec left pointing at next/ after the 2.3.0 bump

Issue: [892-fix-migrationscliinstall-spec-left-pointing-at-next-after-the-2-3-0-bump.md](../../issues/892-fix-migrationscliinstall-spec-left-pointing-at-next-after-the-2-3-0-bump.md)

## Overview
The 2.3.0 bump (#891) moved `repos/next/001.*` into `repos/2.3.0/` and reset `repos/next/migrations.json` to `[]`. `scripts/bump-version.sh` only rewrites `repos/next/NNN` references, so the spec's `MANIFEST` (`repos/next/migrations.json`) and `SCRIPT_RELATIVE` (assembled from `'repos', 'next'` segments) were left behind. This plan:

1. fixes the spec;
2. adds a convention spec that scans `core/spec/**` for the two forbidden patterns;
3. extends the Spec convention in `per-repo-migrations.md`.

## Context
- The failing expectation is `core/spec/bin/migrationsCliInstall_spec.js:256`. It reads `MANIFEST` (line 26), which still points at the now-empty `repos/next/migrations.json`.
- `SCRIPT` (line 25) is already `'arcanum/migrations/repos/2.3.0/001.sh'`, because the bump rewrote it.
- `SCRIPT_RELATIVE` (line 27) is `path.join('arcanum', 'migrations', 'repos', 'next', '001.sh')`. It's used at line 140 to place the script copy inside the fake install.
- Two `describe` titles are stale: `'next/001 arcanum-cli install migration'` (line 83) and `'monitor-issues clear_context migration (next/001)'` in `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js:19`. The latter's `SCRIPT` is `repos/2.2.0/001.sh`.
- Jasmine runs `spec/{lib,bin,release}/**/*_spec.js` (`core/spec/support/jasmine.json`). `REPO_ROOT` comes from `core/spec/support/utils/runCommand.js`.
- The rules live in `docs/agents/architecture/per-repo-migrations.md` → "Referencing pending migrations" → **Spec convention**.

## Steps

- [01 — Fix the migration spec paths and stale titles](node/01-fix-migration-spec-paths.md)
- [02 — Add the migration-reference convention spec](node/02-add-convention-spec.md)
- [03 — Extend the Spec convention doc](node/03-extend-spec-convention-doc.md)

## CI Checks
- `core`: `cd core && yarn test` (CI job: `test`, step "Run tests with coverage")
- `core`: `cd core && yarn lint` (CI job: `test`)

## Notes
- Out of scope: the 4 pending `2.0.0 auto-next migrations … without a TTY` specs, any change to `bump-version.sh`, and a bump-time guard.
- Step 03 edits an architect-owned architecture doc. The change only concerns how `core/spec` references migrations, so `node` makes it, and the architect reviews it in the PR.
- Known limitation, to document in the spec header and in the doc: template literals and variables that hold `'next'` are not detected.
- Final live check: the next release's `bump-version.sh` run must leave the core suite green without any manual spec edits.
