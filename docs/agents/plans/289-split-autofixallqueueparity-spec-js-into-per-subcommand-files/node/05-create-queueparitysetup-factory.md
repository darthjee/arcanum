# Create queueParitySetup.js

New file `core/spec/support/factories/queueParitySetup.js`, mirroring the shape of `githubParitySetup.js` but for the queue family's own structure (per-subcommand shell scripts, not a single dispatcher; only `save`/`push` use git fixtures). Ported from `autoFixAllQueueParity_spec.js`'s current top-level declarations, with `runCommand`/`git`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD`/`REPO_ROOT` now pulled from the shared `runCommand.js` (step 01) instead of being recomputed locally — the queue spec's own `NATIVE_BIN`/`FAKE_FETCH_PRELOAD` constants are already byte-identical to the shared exports, so this is a pure dedup, no behavior change:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, REPO_ROOT, runCommand, seedOriginUrl } from '../utils/runCommand.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-queue-fixture.git';
const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');

export const SHELL_SCRIPTS = {
  save: path.join(SCRIPTS_DIR, 'queue_save_shell.sh'),
  next: path.join(SCRIPTS_DIR, 'queue_next_shell.sh'),
  'wait-next': path.join(SCRIPTS_DIR, 'queue_wait_next_shell.sh'),
  push: path.join(SCRIPTS_DIR, 'queue_push_shell.sh'),
  pop: path.join(SCRIPTS_DIR, 'queue_pop_shell.sh'),
  empty: path.join(SCRIPTS_DIR, 'queue_empty_shell.sh'),
  list: path.join(SCRIPTS_DIR, 'queue_list_shell.sh')
};

export const NATIVE_COMMANDS = {
  save: 'auto-fix-all-queue-save',
  next: 'auto-fix-all-queue-next',
  'wait-next': 'auto-fix-all-queue-wait-next',
  push: 'auto-fix-all-queue-push',
  pop: 'auto-fix-all-queue-pop',
  empty: 'auto-fix-all-queue-empty',
  list: 'auto-fix-all-queue-list'
};

// (JSDoc as in the original file)
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

// (JSDoc as in the original file)
export async function seedQueue(repoPath, ids) {
  const file = path.join(repoPath, '.claude', 'state', 'auto-fix-all-queue.json');

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ids.map((id) => ({ id }))));
}

// (JSDoc as in the original file — the queue equivalent of runBoth)
export async function runPair(subcommand, shellRepo, nativeRepo, rest, { env = {}, fakeFetch = false } = {}) {
  const baseEnv = { ...process.env, ...env };

  const shell = await runCommand([SHELL_SCRIPTS[subcommand], shellRepo, ...rest], shellRepo, baseEnv);

  const nativeArgs = fakeFetch
    ? [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, NATIVE_COMMANDS[subcommand], nativeRepo, ...rest]
    : [process.execPath, NATIVE_BIN, NATIVE_COMMANDS[subcommand], nativeRepo, ...rest];
  const nativeEnv = fakeFetch ? { ...baseEnv, ARCANUM_TEST_FAKE_FETCH: 'queue' } : baseEnv;

  const native = await runCommand(nativeArgs, nativeRepo, nativeEnv);

  return { shell, native };
}

/**
 * Orchestrates the setup shared by every `save`/`push` test case: a fake
 * `gh` binary and two independent git fixture repos (one per side, never
 * shared), both rewritten to a github.com-shaped `origin`. Deliberately
 * separate from githubParitySetup.js's setupParityTest — that one's
 * seedEnv hardcodes ARCANUM_TEST_FAKE_FETCH: 'github', whereas queue's
 * fake-fetch mode (passed directly to runPair as fakeFetch: true) is
 * 'queue', and queue's env customization (FAKE_GH_*/FAKE_FETCH_* vars)
 * is passed straight through runPair's own `env` option rather than
 * through a ghVars/fetchVars-splitting seedEnv.
 * @returns {Promise<{shellRepo: object, nativeRepo: object, fakeGh: object, cleanup: Function}>}
 *   the built fixtures, ready for runPair, plus a cleanup() that tears
 *   all of them down together.
 */
export async function setupParityTest() {
  const fakeGh = await createFakeGhBin();
  const shellRepo = await createGitFixtureRepo();
  const nativeRepo = await createGitFixtureRepo();

  await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

  return {
    shellRepo,
    nativeRepo,
    fakeGh,
    cleanup: () => Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])
  };
}
```

Carry over the original file's JSDoc comments for `seedGithubLikeRepo`/`seedQueue`/`runPair` verbatim (only updating `seedGithubLikeRepo`'s doc's mention of `git` if needed to reflect the `seedOriginUrl` call).

## Files to Change

- `core/spec/support/factories/queueParitySetup.js` (new) — `SHELL_SCRIPTS`, `NATIVE_COMMANDS`, `seedGithubLikeRepo`, `seedQueue`, `runPair`, `setupParityTest`, as above.
