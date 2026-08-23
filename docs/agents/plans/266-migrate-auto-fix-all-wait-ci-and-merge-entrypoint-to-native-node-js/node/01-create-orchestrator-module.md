# Create the native orchestrator module

Create `core/lib/AutoFixAllWaitCiAndMerge.js`, a native counterpart of `auto-fix-all/scripts/wait_ci_and_merge.sh`, following the constructor-injection pattern already used by `AutoFixAllWaitCi` and `AutoFixAllGithub` (both accept an options object of injectable collaborators, defaulting to real instances).

The class takes `waitCi = new AutoFixAllWaitCi()` and `github = new AutoFixAllGithub()` as injectable constructor deps (for unit-test mocking), and exposes:

```js
async run(repoPath, modelEmail) {
  if (!repoPath) {
    throw new Error('Usage: wait_ci_and_merge.sh <repo_path> [model_email]');
  }

  const waitOutput = await this._waitCi.run(repoPath);

  if (!waitOutput.startsWith('passed')) {
    return waitOutput;
  }

  const mergeOutput = await this._github.prMerge(repoPath, modelEmail);
  return `passed\n${mergeOutput}`;
}
```

Match `wait_ci_and_merge.sh`'s exact contract (see `plan.md`'s Shared contracts section): `passed\n<url>\n` on a successful CI+merge, the untouched `failed\n...` output when CI failed (merge never attempted), and any thrown `Error` from either collaborator propagates unchanged (no swallowing/wrapping) — mirroring the shell script's `set -euo pipefail` behavior of letting a hard failure abort with a non-zero exit.

Add full JSDoc on the class and `run` method, following the style already used in `AutoFixAllWaitCi.js`/`AutoFixAllGithub.js` (param/return/throws documented, cross-referencing this plan file).

## Files to Change

- `core/lib/AutoFixAllWaitCiAndMerge.js` — new file, the native orchestrator class.
