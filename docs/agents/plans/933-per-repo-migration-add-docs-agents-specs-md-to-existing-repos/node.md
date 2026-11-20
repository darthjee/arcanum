# Node Plan: Per-repo migration: add docs/agents/specs.md to existing repos

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on `scripter` producing `arcanum/migrations/repos/next/001.sh`, its manifest entry, and its
`config`/`run` behavior and output lines exactly as listed in [plan.md](plan.md#shared-contracts).
Use the real id if `scripter` reports one other than `001`.

## Implementation Steps

### Step 1 — Contract spec for the script entry

Add `core/spec/bin/migrationsSpecsIndex_spec.js`, modeled on
`core/spec/bin/migrationsCoauthorPolicy_spec.js` (temp dir as cwd, `runCommand(['bash', SCRIPT,
...])`). Per the per-repo-migration spec conventions: `const SCRIPT = path.join(REPO_ROOT,
'arcanum/migrations/repos/next/001.sh')` as one literal, and
`const MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json')` (never a
`repos/next/migrations.json` literal, never `'repos', 'next'` segments). Read the template from
`path.join(REPO_ROOT, 'init-claude/templates/specs.md')`.

Cases:
- `config` prints `{"skippable": true}\n`, exit 0.
- Manifest declares `{id: '001', type: 'script', file: '001.sh', skippable: true, applies_to: 'repo'}`.
- Fresh repo (no `docs/agents/`) → `specs.md` byte-identical to the template, `specs/.gitkeep` exists.
- Existing `specs.md` with custom content → unchanged; `.gitkeep` still created when `specs/` is missing.
- `docs/agents/specs` is a file → unchanged, no `.gitkeep`, warning on stderr, exit 0, `specs.md` still created.
- `specs/` contains a spec file → no `.gitkeep`.
- `specs/` contains only a hidden file (e.g. `.DS_Store`) → no `.gitkeep`.
- Re-run → no file changes (compare tree contents before/after).

## Files to Change
- `core/spec/bin/migrationsSpecsIndex_spec.js` — new contract spec.

## CI Checks
- `core`: `make core-check` (CI job: core lint/test)

## Notes
- This is a contract spec, not a parity spec; there is no native counterpart.
- No spec for the `instructions` entry (out of scope).
