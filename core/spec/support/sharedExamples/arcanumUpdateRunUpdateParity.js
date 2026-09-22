/**
 * Shared example: shell vs. native parity for a single
 * arcanum-update-run-update-check/-apply scenario. Registers an
 * `it(description, ...)` block that runs the caller-supplied `run`
 * closure (which performs whatever fixture setup and shell/native
 * invocation the scenario needs), asserts byte-identical stdout/exit
 * code between shell and native, asserts the expected exit code, and
 * asserts the expected stdout (exact match for a string, `toMatch` for
 * a `RegExp`) — then tears the scenario down via the returned
 * `cleanup`.
 * @param {string} description - the `it` block's label.
 * @param {() => Promise<{shell: object, native: object, cleanup: () => Promise<void>}>} run
 *   - performs this scenario's fixture setup and shell/native
 *   invocation, resolving to the shell/native results plus a
 *   zero-argument async `cleanup` tearing down whatever `run` created.
 * @param {object} expected - the scenario's expected outcome.
 * @param {number} expected.code - the expected `shell.code`.
 * @param {string|RegExp} expected.stdout - the expected `shell.stdout`;
 *   a `RegExp` is matched via `toMatch`, otherwise matched exactly via
 *   `toEqual`.
 * @returns {void}
 */
export function itMatchesParity(description, run, expected) {
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
}
