# Node Plan: Ship the arcanum-next-step mod (clear context + submit next command)

Main plan: [plan.md](plan.md)

## Shared contracts

Consumes `scripts/build_release_zip.sh --list` and the **mod folder layout** from
[plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Packaging spec

Add a spec that runs `scripts/build_release_zip.sh --list` from the repo root (via
`execFile` with an argument array) and asserts:

- exit 0;
- the output contains `arcanum-next-step/.claude-plugin/plugin.json`,
  `arcanum-next-step/hooks/hooks.json`, `arcanum-next-step/hooks/register.ts`,
  `arcanum-next-step/types/index.d.ts` and `arcanum-next-step/README.md`;
- no path under `arcanum-next-step/.claude-plugin/types/` is listed.

Place it where repo-level specs fit the existing layout (e.g. a new
`core/spec/release/` folder), following the spec naming conventions.

## Files to Change

- `core/spec/release/buildReleaseZipList_spec.js` (or equivalent location) — new.

## CI Checks

- `core`: `make core-check` (CI jobs: `test`, `checks`).

## Notes

- The test image needs `git` for `git ls-files` (other specs already use it).
- Lands after `mod` and `scripter`: it asserts their files exist.
