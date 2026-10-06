# Issue: Fix release

## Description

The CI `test` job failed on `main` right after the version bump (#721), so the release is red. All 6 failures are in `core/spec/bin/migrationsNextStepAuto_spec.js`:

```
1) next/ auto-next migrations 00{1,2,3}.sh rejects an unknown subcommand
  Expected 'ENOENT' to equal 1.
  Expected '' to contain 'Usage:'.
2) next/ auto-next migrations 00{1,2,3}.sh config prints {"skippable": true}
  Expected $.stdout = '' to equal '{"skippable": true}\n'.
  Expected $.code = 'ENOENT' to equal 0.

1998 specs, 6 failures, 4 pending specs
```

The 4 pending specs are expected: the CI container can still open `/dev/tty` from a detached process, so the no-TTY branch is skipped there.

## Problem

`scripts/bump-version.sh` rolled `arcanum/migrations/repos/next/001–003.{sh,md}` into `arcanum/migrations/repos/2.0.0/`, as designed. However, `migrationsNextStepAuto_spec.js` hardcodes `MIGRATIONS_DIR` as `.../repos/next`, so after the bump the scripts no longer exist there and `execFile` fails with `ENOENT`.

This is a recurring problem, not a one-off:

- `core/spec/bin/migrationsEpicLabel_spec.js` already hardcodes `repos/1.2.0`, after being fixed by hand following an earlier bump. Every migration spec written against `next/` breaks on the following release.
- Docs have the same drift. Ten references still cite `repos/next/NNN` (or just the `next/` folder) for migrations that have already shipped in versioned folders:
  - `docs/agents/architecture/issue-tags.md:25` (shipit permission, `001–003.sh`) and `:51` (Epic label, now in `1.2.0`)
  - `docs/agents/architecture/script-engine.md:107` and `docs/agents/specs/shell-engine-removal.md:5` (engine.mode deprecation, #601)
  - `docs/agents/architecture/shared-state-and-configuration.md:11–12` (auto-fix-all re-seed) and `:40` (auto-next migrations, now `2.0.0`)
  - `docs/agents/architecture/skill-finish.md:126` (auto-next migrations, now `2.0.0`)
  - `docs/agents/architecture/dispatch-permissions.md:71`
  - `docs/guides/arcanum-repo-version.md:52`

Because ids restart at `001` after every roll-over (`arcanum/migrations/generate_next.sh` only reads `next/migrations.json`), `next/001` has meant different migrations at different times. A stale reference is therefore not just outdated, it is ambiguous.

## Expected Behavior

- The release is green again: `migrationsNextStepAuto_spec.js` runs against the migrations where they now live.
- After any future `scripts/bump-version.sh` run, specs and docs that referred to the migrations it rolled out of `next/` point at the new `<version>/` folder automatically. No manual follow-up, no red release.
- Docs no longer cite `repos/next/NNN` for migrations that have already shipped.
- Historical records (`docs/agents/issues/**`, `docs/agents/plans/**`) keep the paths that were true when they were written.

## Solution

### 1. Immediate fix

In `core/spec/bin/migrationsNextStepAuto_spec.js`, point the migrations at `arcanum/migrations/repos/2.0.0`. List each file explicitly with a single string literal (e.g. `path.join(REPO_ROOT, 'arcanum/migrations/repos/2.0.0/001.sh')`, likewise for `002.sh` and `003.sh`) rather than joining `'repos', '2.0.0'` and appending `${id}.sh`, following the convention in section 3.

### 2. `scripts/bump-version.sh` rewrites references to the migrations it moves

When the bump rolls `next/` into `<new-version>/`, it also rewrites `arcanum/migrations/repos/next/<file>` → `arcanum/migrations/repos/<new-version>/<file>` for exactly the files it moved.

- **Scope:** `core/spec/**`, `docs/**` and `README.md`, **excluding** `docs/agents/issues/**` and `docs/agents/plans/**` (historical records). `scripts/` and `arcanum/` are out of scope.
- **Only moved files:** a reference is rewritten only if its `NNN` file exists in `next/` when the bump runs.
- **Exact matches:** the pattern requires `next/NNN` followed by `.`, a quote, or a word boundary (so `next/001` never matches `next/0010`), and covers `NNN.sh`, `NNN.md`, `NNN.instructions.md` and a bare `NNN`.
- **Generic `next/` references are left alone:** `arcanum/migrations/generate_next.sh`, `arcanum/migrations/_pending_versions.sh`, `bump-version.sh` itself, and prose such as "`next/` holds unreleased migrations" never change, because only `next/NNN` within the scope above is matched.
- **Nothing pending:** with an empty `next/`, or several bumps in a row, nothing moves and nothing is rewritten.
- **Portability:** follow the script's existing `sed -i.bak` + `rm` pattern so it works with both BSD (macOS) and GNU sed.

### 3. Conventions, documented in `docs/agents/architecture/per-repo-migrations.md`

- When a doc or spec refers to a pending migration, cite the **specific file** (`arcanum/migrations/repos/next/001.sh`), not just the `next/` folder, so the bump-time rewrite can find and update it.
- Specs name each migration file with **one string literal**, listing every file explicitly, instead of building the folder path with `path.join(..., 'repos', 'next')` and appending ids. Rewriting the folder-level form was rejected: it breaks once a spec covers both a moved migration and something that really belongs to `next/`.

### 4. Fix the existing stale doc references

Trace each of the 10 references listed under Problem (via git history and the referenced issue number) to the version folder it actually shipped in, and update it. Where a reference names only the `next/` folder, rewrite it to cite the specific files. This has to land **before** the new rewrite runs for the first time; otherwise a stale `next/001` could be rewritten to the wrong (new) version.

### 5. Bump-time guard

Before moving anything, `scripts/bump-version.sh` scans the same scope as the rewrite (section 2) for `arcanum/migrations/repos/next/NNN` references. If any reference names a file that doesn't exist in `next/`, the bump aborts with a non-zero exit and lists each offending `file:line`. It's a stale reference that a roll-over would otherwise rewrite to the wrong version. No CI check is added; the bump is where the danger actually exists.

### 6. Testing

Add `scripts/test_bump_version.sh`, following the existing `scripts/test_generate_tags_table.sh` pattern. It runs the bump against a temporary copy of the relevant tree and asserts that:

- references to moved `next/NNN` files in specs, docs and `README.md` are rewritten to `<new-version>/NNN`;
- `docs/agents/issues/**`, `docs/agents/plans/**`, `scripts/`, `arcanum/`, and generic `next/` folder mentions are left untouched;
- `next/001` does not match `next/0010`;
- an empty `next/` rewrites nothing;
- a stale `next/NNN` reference (no such file in `next/`) makes the bump abort before anything is moved.

### Delivery

Everything ships in a single PR. The spec fix (section 1) is small, so the release is unblocked as soon as that PR merges.

### Rejected alternatives

- **Spec discovers the migration dynamically** (scan `repos/*/migrations.json`): ids restart at `001` in every version folder, so an id doesn't identify a migration uniquely. A per-script marker would be needed, which is fragile and over-engineered.
- **A CI check for stale `next/NNN` references** instead of the bump-time guard: it would flag drift continuously, but the only harmful moment is the roll-over itself, so the check lives in `bump-version.sh`.
- **Hardcode the new version on every bump** (what was done for `migrationsEpicLabel_spec.js`): unblocks one release, but repeats the failure on the next one.

## Benefits

- The release is unblocked.
- Version bumps no longer break migration specs, so there's no more "bump, red CI, fix the path by hand" cycle.
- Docs stay accurate about where each migration actually ships, without someone having to remember to update them.
