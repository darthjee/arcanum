# Issue: Codacy: duplication cluster — arcanumUpdateRunUpdateParity check/apply pair (108 clone groups, 2 files)

## Context

`core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` and `apply_spec.js` share a duplicated shell/native parity-assertion block. `check_spec.js` repeats it 4 times internally (once per test, each following a single-dir `runPair(...)` call). `apply_spec.js`'s last test (`missing_arcanum`) repeats the same shape via `runPair` too, but its first three tests use a structurally different setup: two separate fixture dirs (`shellDir`/`nativeDir`) with extra fixture files (`.fixture-new-version`, `.fixture-fail`) written into both before running shell and native manually via `runCommand` rather than `runPair`. Codacy reports 108 clone groups and roughly 140 duplicated lines across the pair. The repeated block in every case is:

```js
expect(native.stdout).toEqual(shell.stdout);
expect(native.code).toEqual(shell.code);
expect(shell.code).toEqual(<expected code>);
expect(shell.stdout).toEqual(<expected stdout>); // or .toMatch(...)
```

The repo already has precedent for this shape of extraction: `core/spec/support/sharedExamples/cliParityValidation.js`'s `itRejectsMissingArgument`/`itRejectsInvalidRepoPath` wrap a `describe`/`it` around an injected `invoke` (and a `cwdFactory`) rather than assuming one uniform fixture-creation signature — the flexibility this pair also needs, since `apply_spec.js`'s dual-dir tests do not fit a single `fixtureState` parameter.

## What needs to be done

- Extract a shared parity-scenario example (name/shape is an implementation decision — e.g. `itMatchesParity` or equivalent) modeled on the existing `itRejectsMissingArgument`/`itRejectsInvalidRepoPath` pattern in `cliParityValidation.js`, taking an injected `invoke` callback (with whatever fixture-setup flexibility `apply_spec.js`'s dual-dir tests need) rather than a single `fixtureState` object.
- Replace the duplicated assertion blocks in both `check_spec.js` and `apply_spec.js` — including the internal repetition in `check_spec.js` and the dual-dir tests in `apply_spec.js` — with calls to the shared helper.
- Place the helper alongside `cliParityValidation.js` in `core/spec/support/sharedExamples/`, or inside the existing `arcanumUpdateRunUpdateParitySetup.js` factory file — whichever keeps it easiest to reuse if another `arcanumUpdateRunUpdateParity`-style suite appears later.

## Acceptance criteria

- [ ] A shared parity-assertion example exists (modeled on `cliParityValidation.js`'s pattern) and is used by both `check_spec.js` and `apply_spec.js`, including `apply_spec.js`'s dual fixture-dir tests.
- [ ] The duplicated run/assert blocks (including the internal repetition in `check_spec.js`) are removed in favor of the shared helper.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.
