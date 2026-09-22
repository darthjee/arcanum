# Add shared parity-assertion example

Add a new shared example file, `core/spec/support/sharedExamples/arcanumUpdateRunUpdateParity.js`, exporting an `itMatchesParity(description, run, expected)` function modeled on the existing `itRejectsMissingArgument`/`itRejectsInvalidRepoPath` pattern in `core/spec/support/sharedExamples/cliParityValidation.js` (both already register a `describe`/`it` block wrapping fixture setup + shell/native run + assertion + cleanup, driven by an injected callback rather than a fixed fixture-creation signature).

`run` is a zero-argument async closure the caller supplies per test — it performs whatever fixture setup and shell/native invocation that specific scenario needs (single fixture dir via `runPair`, or two separate dirs run manually via `runCommand`) and resolves to `{ shell, native, cleanup }`, where `cleanup` is a zero-argument async function tearing down whatever `run` created. This lets one helper cover both `check_spec.js`'s uniform single-dir tests and `apply_spec.js`'s dual-dir tests without forcing a single `fixtureState` shape onto both.

`expected` is `{ code, stdout }`: `code` is the expected `shell.code` (a number), and `stdout` is either a string (exact match via `toEqual`) or a `RegExp` (matched via `toMatch`) — `check_spec.js`'s untagged-git test currently asserts a regex, everything else an exact string.

The registered `it` block's body should be equivalent to:

```js
it(description, async () => {
  const { shell, native, cleanup } = await run();

  try {
    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(expected.code);

    if (expected.stdout instanceof RegExp) {
      expect(shell.stdout).toMatch(expected.stdout);
    } else {
      expect(shell.stdout).toEqual(expected.stdout);
    }
  } finally {
    await cleanup();
  }
});
```

Wrap it in a `describe(description, ...)` the same way `cliParityValidation.js`'s examples do, or take the `it`-level description directly and let call sites supply their own surrounding `describe` — match whichever wrapping keeps `check_spec.js`'s and `apply_spec.js`'s existing `describe` structure (one `describe` per file, one `it` per scenario) unchanged.

## Files to Change

- `core/spec/support/sharedExamples/arcanumUpdateRunUpdateParity.js` (new) — shared `itMatchesParity` example.
