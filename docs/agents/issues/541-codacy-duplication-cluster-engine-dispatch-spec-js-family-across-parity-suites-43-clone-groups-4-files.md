# Codacy: duplication cluster — engine_dispatch_spec.js family across Parity suites (43 clone groups, 4 files)

## Context

Four "engine dispatch" specs share duplicated routing-test scaffolding:

- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`

`autoFixIssueGithubParity/engine_dispatch_spec.js` and `autoFixAllWaitCiParity/engine_dispatch_spec.js` each duplicate an identical inline `seedEngineMode(repo, mode)` helper plus a repeated seed/run/assert try-finally scaffold (and `autoFixIssueGithubParity/engine_dispatch_spec.js` additionally self-duplicates this scaffold 3 more times internally, once per sub-command). `autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js` has already partly deduplicated this by exporting `SHIM_SCRIPT`/`seedLocalState` from its own setup factory instead of duplicating `seedEngineMode` inline. `autoFixAllGithubParity/engine_dispatch_spec.js` is structurally different from the other three: it has no GitHub/PR fixture and no `fakeGh`, exercises the generic `engine_dispatch.sh` via a throwaway wrapper script rather than a real per-entrypoint shim, and its own `seedEngineMode(repoDir, mode)` takes a plain directory instead of a repo object. Codacy reports 43 clone groups and roughly 150 duplicated lines across this family. Per-case assertions (stdout/stderr/exit code) genuinely differ per subcommand and file rather than reducing to a fixed "expected args" shape.

## What needs to be done

- Extract a shared `seedEngineMode(repo, mode)`-equivalent helper out of `autoFixIssueGithubParity/engine_dispatch_spec.js` and `autoFixAllWaitCiParity/engine_dispatch_spec.js`, following the same per-suite setup-factory pattern `autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js` already uses (`seedLocalState`/`SHIM_SCRIPT` exported from its own factory).
- Build a shared, flexible dispatch-routing example (e.g. `itRoutesEngineDispatch(...)`) that takes per-case shell/native env and expectation callbacks — not a fixed `(name, expectedArgs)` dispatch table — since actual stdout/stderr/exit-code assertions differ per subcommand and file.
- Apply the shared example to the three GitHub-fixture-based files: `autoFixIssueGithubParity/engine_dispatch_spec.js` (its 4 internally-repeated sub-commands: info, pr-create, pr-view, pr-ready), `autoFixAllWaitCiParity/engine_dispatch_spec.js`, and `autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`.
- Give `autoFixAllGithubParity/engine_dispatch_spec.js` its own smaller, separate extraction (e.g. its own `seedEngineMode`) instead of forcing it into the shared GitHub-fixture harness, since it tests a structurally different thing (generic `engine_dispatch.sh` routing via a throwaway fixture, no GitHub/PR setup).

## Acceptance criteria

- [ ] A shared, flexible dispatch-routing example (e.g. `itRoutesEngineDispatch`) exists and is used by `autoFixIssueGithubParity`, `autoFixAllWaitCiParity`, and `autoFixAllWaitCiAndMergeParity`'s engine_dispatch specs, replacing their duplicated `seedEngineMode` + try/finally scaffolding (including the internal repetition in `autoFixIssueGithubParity/engine_dispatch_spec.js`).
- [ ] `autoFixAllGithubParity/engine_dispatch_spec.js` gets its own separate, smaller extraction (not forced into the shared harness) given its structurally different fixture setup.
- [ ] All four specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this family drops substantially after the fix lands.
