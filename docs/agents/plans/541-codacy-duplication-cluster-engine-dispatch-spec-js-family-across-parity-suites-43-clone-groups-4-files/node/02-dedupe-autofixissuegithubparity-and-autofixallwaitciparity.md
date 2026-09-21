# Dedupe autoFixIssueGithubParity and autoFixAllWaitCiParity

Apply step 01's shared helpers to the two files with the near-identical duplicated `seedEngineMode` + seed/run/assert scaffold, removing their own inline copies.

- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`: drop the inline `seedEngineMode` function and import it from `../../support/utils/engineMode.js` instead. Replace each of the 4 sub-command `describe` blocks (`info`, `pr-create`, `pr-view`, `pr-ready`) with a call to `itRoutesEngineDispatch(...)`, moving each case's distinguishing setup (e.g. `createFakeGhBin()`, writing `body.md`, `FAKE_GH_*`/`FAKE_GH_PR_*` env vars) into that case's `prepare` callback, and its distinguishing expectations (`result.code`/`result.stdout`/`result.stderr` checks, exactly as they exist today) into that case's `shell`/`native` assertion callbacks. Preserve the file's existing top-of-file comment explaining why this spec exercises the real shim (unlike sibling specs).
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js`: same treatment — drop the inline `seedEngineMode`, import the shared one, and replace the single `'engine_dispatch routing (via the real wait_ci.sh shim)'` `describe` block with one `itRoutesEngineDispatch(...)` call, moving its `fakeGh`/env setup into `prepare` and its `result.code`/`stdout`/`stderr` checks into the `shell`/`native` callbacks. Preserve the file's existing header comment explaining the `env -i` stripping behavior.
- If `itRoutesEngineDispatch`'s signature from step 01 turns out not to fit one of these cases cleanly once written against real code, adjust the shared example's signature here rather than special-casing the spec — step 01 and this step are not strictly one-way.

## Files to Change

- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js` — replace inline `seedEngineMode` + per-sub-command scaffolding with `itRoutesEngineDispatch(...)` calls.
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js` — replace inline `seedEngineMode` + scaffolding with a single `itRoutesEngineDispatch(...)` call.
