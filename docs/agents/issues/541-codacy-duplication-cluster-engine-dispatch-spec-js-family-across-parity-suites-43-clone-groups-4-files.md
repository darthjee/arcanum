# Codacy: duplication cluster — engine_dispatch_spec.js family across Parity suites (43 clone groups, 4 files)

## Context

Four "engine dispatch" specs share an identical ~15-26 line dispatch-table-invocation block:

- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`

`autoFixAllWaitCiParity/engine_dispatch_spec.js` lines 8-34/60-88 line up against `autoFixIssueGithubParity/engine_dispatch_spec.js` lines 10-56/184-242 nearly verbatim, and `autoFixIssueGithubParity/engine_dispatch_spec.js` additionally self-duplicates the same block 3 more times internally for each sub-command. Codacy reports 43 clone groups and roughly 150 duplicated lines across this family.

## What needs to be done

- Extract a shared `itDispatchesSubcommand(name, expectedArgs)` example.
- Build a common dispatch-table test harness reused by all four parity suites instead of re-authoring the dispatch assertions per command family.
- Apply the shared example/harness to all four files listed above.

## Acceptance criteria

- [ ] A shared `itDispatchesSubcommand(name, expectedArgs)` example (or equivalent) exists and is used by all four listed specs.
- [ ] The duplicated dispatch-table blocks (including the internal repetition in `autoFixIssueGithubParity/engine_dispatch_spec.js`) are replaced by the shared example.
- [ ] All four specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this family drops substantially after the fix lands.
