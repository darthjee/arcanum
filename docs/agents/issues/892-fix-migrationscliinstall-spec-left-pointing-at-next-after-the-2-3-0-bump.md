# Issue: Fix migrationsCliInstall spec left pointing at next/ after the 2.3.0 bump

## Description

After the 2.3.0 version bump (#891), CI's core suite fails on `test` → "Run tests with coverage":

```
1) next/001 arcanum-cli install migration migrations.json declares exactly the skippable global 001 script entry
  Expected $.length = 0 to equal 1.
  Expected $[0] = undefined to equal Object({ id: '001', type: 'script', file: '001.sh', skippable: true, applies_to: 'global' }).
  at core/spec/bin/migrationsCliInstall_spec.js:256
```

## Problem

The `Bump version 2.3.0` commit (#891) moved `arcanum/migrations/repos/next/001.{sh,md}` into `repos/2.3.0/`, wrote the entry into `repos/2.3.0/migrations.json`, and reset `repos/next/migrations.json` to `[]`.

`scripts/bump-version.sh` only rewrites `repos/next/NNN` references (regex `repos/next/[0-9]{3}([^0-9]|$)`). In `core/spec/bin/migrationsCliInstall_spec.js`:

- `SCRIPT` (`'arcanum/migrations/repos/next/001.sh'`) was one string literal, so it was rewritten to `2.3.0`.
- `MANIFEST` (`'arcanum/migrations/repos/next/migrations.json'`) does not match the regex, so it still points at `next/`, which is now `[]`. That's the failure.
- `SCRIPT_RELATIVE` (`path.join('arcanum', 'migrations', 'repos', 'next', '001.sh')`) is split into segments, so it was not rewritten either. It still works, because it's only where the fake install copies the script, but it no longer matches the header comment (which now says `2.3.0`).
- The `describe('next/001 …')` title also still says `next/001`.

## Expected Behavior

### Acceptance criteria

- `migrationsCliInstall_spec.js` passes on CI.
- The spec has no `repos/next` path left that a future bump would leave stale.
- The Spec convention in `per-repo-migrations.md` covers manifest paths.
- The new convention spec passes on the current tree and fails, naming `<file>:<line>`, when either forbidden pattern is added to a file under `core/spec/`.

## Solution

### Fix the spec

In `core/spec/bin/migrationsCliInstall_spec.js`:

- Derive the manifest from the script's own folder (`MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json')`), so it follows the script on every future bump without depending on the bump regex.
- Build `SCRIPT_RELATIVE` from the same folder, so the fake install's layout matches the real one (`repos/2.3.0/001.sh`) and the header comment.
- Rename the top-level `describe` from `next/001 …` to `2.3.0/001 …`.

Also fix the same leftover in `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js:19`. Its title still reads `'… migration (next/001)'`, but its `SCRIPT` points at `repos/2.2.0/001.sh`. Rename it to `2.2.0/001`.

### Guard against a repeat

The spec already broke the existing **Spec convention** in `docs/agents/architecture/per-repo-migrations.md` ("Referencing pending migrations"): `SCRIPT_RELATIVE` assembles `'repos', 'next'`. The convention also never covered `migrations.json`, and nothing enforces it. Two additions:

1. **Doc:** Extend the Spec convention. A spec that reads a migration's manifest derives the path from the script path (`path.join(path.dirname(SCRIPT), 'migrations.json')`) and never writes `repos/next/migrations.json` as a literal. Restate that `'repos', 'next'` segment assembly is forbidden.
2. **CI-time convention spec:** Add a core spec that scans `core/spec/**` (excluding `node_modules/`) and fails, naming `<file>:<line>`, on:
   - a `repos/next/migrations.json` literal;
   - `'repos', 'next'` segment assembly (e.g. `path.join(..., 'repos', 'next', ...)`).

   This catches a violation in the PR that introduces it, long before a release.

### Edge cases

- **Current tree:** the only hits today are `migrationsCliInstall_spec.js:26` (`MANIFEST`) and `:27` (`SCRIPT_RELATIVE`). Every other migration spec already uses a versioned literal. Once those are fixed, the convention spec passes without any allowlist.
- **`describe` titles:** they're not scanned, because that would be noisy (`next_step`, `queue 'next'`, …). Stale titles are fixed by hand here (see Proposed fix). The doc convention should say that `describe` titles either name the migration without its folder or get updated at bump.
- **Self-match:** the convention spec builds its patterns from pieces, so its own source never contains them literally. No self-exclusion special case is needed.
- **Pattern variants:** match both quote styles and any whitespace (`'repos', 'next'`, `"repos","next"`), and `repos/next/migrations.json` inside any string. Known, documented limitation: template literals (`` `repos/${dir}` ``) and variables that hold `'next'` are not caught. A grep-level check is good enough, so no AST parsing.
- **Legitimate future need for `next/`:** there's no allowlist for now. The doc names the alternatives: glob `repos/*/`, or build fixture folders under a neutral name. If a real need appears later, an opt-out comment marker can be added then.
- **Scan scope:** only `core/spec/**`, excluding `node_modules/`. `cli/spec` and `shared/spec` don't touch migrations, and `scripts/test_bump_version.sh` has to reference `next/` by design.

### Testing strategy

- The existing core suite (`Run tests with coverage`) must go green on CI.
- The new convention spec is covered by its own run on the current tree, which has to pass. A red/green check against a planted violation is optional during implementation.
- Live check: the next release's `scripts/bump-version.sh` run must leave the core suite green, without any manual spec edits after the bump.

### Out of scope

- The 4 pending `2.0.0 auto-next migrations … without a TTY` specs. They skip on purpose, because the CI environment can still open `/dev/tty` from a detached process. They're unrelated to this failure.
- Extending `bump-version.sh` to also rewrite `repos/next/migrations.json` references. That would be wrong in general, since a reference to `next/migrations.json` can legitimately mean "the pending manifest".
- A bump-time guard in `bump-version.sh` (rejected: it would only fire at release, after the bad spec has merged, and it would duplicate the CI-time convention spec).

## Benefits

- CI goes green again.
- Future version bumps no longer leave migration specs pointing at an empty `next/` manifest.
- A violation of the spec convention fails in the PR that introduces it, not at release time.
