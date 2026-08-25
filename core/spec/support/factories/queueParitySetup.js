import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, REPO_ROOT, runCommand, seedOriginUrl } from '../utils/runCommand.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-queue-fixture.git';
const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');

/** The `auto-fix-all-queue-*` shell entrypoints' script paths, by subcommand. */
export const SHELL_SCRIPTS = {
  save: path.join(SCRIPTS_DIR, 'queue_save_shell.sh'),
  next: path.join(SCRIPTS_DIR, 'queue_next_shell.sh'),
  'wait-next': path.join(SCRIPTS_DIR, 'queue_wait_next_shell.sh'),
  push: path.join(SCRIPTS_DIR, 'queue_push_shell.sh'),
  pop: path.join(SCRIPTS_DIR, 'queue_pop_shell.sh'),
  empty: path.join(SCRIPTS_DIR, 'queue_empty_shell.sh'),
  list: path.join(SCRIPTS_DIR, 'queue_list_shell.sh')
};

/** `core/bin/arcanum`'s matching command names, by subcommand. */
export const NATIVE_COMMANDS = {
  save: 'auto-fix-all-queue-save',
  next: 'auto-fix-all-queue-next',
  'wait-next': 'auto-fix-all-queue-wait-next',
  push: 'auto-fix-all-queue-push',
  pop: 'auto-fix-all-queue-pop',
  empty: 'auto-fix-all-queue-empty',
  list: 'auto-fix-all-queue-list'
};

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * — `Origin.js`/`origin.sh` both need a recognizable origin URL to
 * derive `{ domain, repo }` from; `_mark_enqueued`/`AutoFixAllQueue`
 * never actually push/fetch against `origin`, so no local-bare-repo
 * transport rewrite is needed (unlike auto-fix-all-reply-comment's
 * parity spec).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Seed a fixture directory's `.claude/state/auto-fix-all-queue.json`.
 * @param {string} repoPath - the fixture directory's path.
 * @param {string[]} ids - the queue's ids, in order.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedQueue(repoPath, ids) {
  const file = path.join(repoPath, '.claude', 'state', 'auto-fix-all-queue.json');

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ids.map((id) => ({ id }))));
}

/**
 * @param {keyof SHELL_SCRIPTS} subcommand - which subcommand to run.
 * @param {string} shellRepo - the shell side's fixture repo path.
 * @param {string} nativeRepo - the native side's fixture repo path.
 * @param {string[]} rest - the args after `<repo_path>`.
 * @param {object} [opts] - options.
 * @param {object} [opts.env] - extra env vars (applied to both sides).
 * @param {boolean} [opts.fakeFetch] - whether to preload the fake-fetch
 *   module and pass `ARCANUM_TEST_FAKE_FETCH=queue` for the native side
 *   (only needed for `save`/`push`, which touch `fetch`).
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
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
 * 'queue', and queue's env customization (FAKE_GH_* / FAKE_FETCH_* vars)
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
