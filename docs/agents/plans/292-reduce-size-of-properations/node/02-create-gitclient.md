# Create GitClient + spec

Add `GitClient`, extracted from `PrOperations`'s `_currentBranch` private method, encapsulating all git CLI interaction via `execFile`. It does **not** receive `RepoContext` — `repoPath` comes in as a method parameter on each call — so it stays reusable outside PR flows. It's a singleton: one instance can serve every call, since it carries no per-call state.

```js
class GitClient {
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  async currentBranch(repoPath) {
    const { stdout } = await this._execFileAsync('git',
      ['branch', '--show-current'], { cwd: repoPath });
    return stdout.trim();
  }
}
```

Read `PrOperations.js`'s current `_currentBranch` implementation directly before writing this, to carry over its exact `execFile` args/options unchanged (this step doesn't yet touch `PrOperations.js` itself — that's step 05 — but the two must behave identically once wired together).

`GitClient_spec.js` mocks `execFileAsync`, verifying `currentBranch` calls it with the right `git branch --show-current` args and `cwd`, and returns the trimmed stdout.

This step is purely additive — nothing imports `GitClient` yet (that happens in steps 05/06).

## Files to Change

- `core/lib/utils/git/GitClient.js` — new class, alongside the existing `Origin.js` (see above)
- `core/spec/lib/utils/git/GitClient_spec.js` — new unit spec
