# Add seedOriginUrl and export REPO_ROOT in runCommand.js, relocate expectParity there

`core/spec/support/utils/runCommand.js` currently exports `runCommand`, `git`, `runBoth`, `SHELL_SCRIPT`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD`, and holds a private `REPO_ROOT` constant. This step adds the two pieces every later step needs already in place:

- Export `REPO_ROOT` (drop the `const` → keep the value, add `export`). It's currently only used internally to build `SHELL_SCRIPT`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD`; the new `queueParitySetup.js` (step 05) needs it too, to build its own `SCRIPTS_DIR` without recomputing the relative path climb from a different file depth.
- Add a new exported function:
  ```js
  /**
   * Rewrites `repoPath`'s `origin` remote to `url` — the one line every
   * parity spec's own origin-seeding helper needs, shared here so none
   * of them has to duplicate it.
   * @param {string} repoPath - the fixture repo's path.
   * @param {string} url - the URL to set `origin` to.
   * @returns {Promise<void>} resolves once set.
   */
  export async function seedOriginUrl(repoPath, url) {
    await git(['remote', 'set-url', 'origin', url], repoPath);
  }
  ```
  (Placed near `git`, since it's built directly on top of it.)
- Move `expectParity` here verbatim from `core/spec/support/factories/githubParitySetup.js` (same JSDoc, same body — just relocated and exported from this file instead):
  ```js
  /**
   * Asserts the shell and native sides of a comparison produced
   * byte-identical stdout and matching exit codes.
   * @param {{stdout: string, code: number}} shell - the shell side's result.
   * @param {{stdout: string, code: number}} native - the native side's result.
   * @returns {void}
   */
  export function expectParity(shell, native) {
    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
  }
  ```

Do not remove `expectParity` from `githubParitySetup.js` yet — that happens in step 02, once every caller of the old location has been repointed (step 03).

## Files to Change

- `core/spec/support/utils/runCommand.js` — export `REPO_ROOT`; add `seedOriginUrl`; add `expectParity` (copied from `githubParitySetup.js`, to be removed there in step 02).
