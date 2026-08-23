import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the 7 "auto-fix-all-queue-*" migrated entrypoints
// (issue #264) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md's
// "Shared contracts". Runs each
// auto-fix-all/scripts/queue_<subcommand>_shell.sh (invoked directly,
// NOT through the auto-fix-all/scripts/queue.sh engine_dispatch shim —
// so this isn't circular, same convention as every sibling parity
// spec, e.g. autoFixAllConfigParity_spec.js) and `core/bin/arcanum
// auto-fix-all-queue-<subcommand>` against identically-seeded fixture
// state, asserting byte-identical stdout and exit code for both.
//
// `next`/`wait-next`/`pop`/`empty`/`list` are pure local file I/O (no
// `gh`/network touchpoint at all), so their fixtures are plain
// (non-git) temp dirs. `save`/`push` additionally best-effort
// tag-mutate the affected GitHub issues, so — per the repo-wide "no
// real network calls in specs" rule — their fixtures are git repos
// with a github.com-shaped `origin` (so `Origin.js`/`origin.sh` can
// resolve `{ domain, repo }`), and both `gh` (shell side) and `fetch`
// (native side) are replaced:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell script's `gh issue
//     view`/`gh issue edit` calls and the native side's
//     `GithubToken#get`'s `gh auth token` call.
//   - the native side's raw `fetch` calls to `api.github.com` are
//     replaced by preloading fakeGithubApiFetchPreload.js's `queue`
//     mode via `node --import` (monkey-patches the global `fetch`
//     before `core/bin/arcanum` is ever imported).
//
// `wait-next` polls forever (a 5s `sleep` between attempts) on an
// empty queue — every scenario below seeds the queue non-empty up
// front, so both implementations resolve on their very first check
// (no real 5s wait, no hang), same testing concern already solved by
// autoFixAllWaitCiParity_spec.js.
//
// None of this touches the real network at any point.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-queue-fixture.git';

const SHELL_SCRIPTS = {
  save: path.join(SCRIPTS_DIR, 'queue_save_shell.sh'),
  next: path.join(SCRIPTS_DIR, 'queue_next_shell.sh'),
  'wait-next': path.join(SCRIPTS_DIR, 'queue_wait_next_shell.sh'),
  push: path.join(SCRIPTS_DIR, 'queue_push_shell.sh'),
  pop: path.join(SCRIPTS_DIR, 'queue_pop_shell.sh'),
  empty: path.join(SCRIPTS_DIR, 'queue_empty_shell.sh'),
  list: path.join(SCRIPTS_DIR, 'queue_list_shell.sh')
};

const NATIVE_COMMANDS = {
  save: 'auto-fix-all-queue-save',
  next: 'auto-fix-all-queue-next',
  'wait-next': 'auto-fix-all-queue-wait-next',
  push: 'auto-fix-all-queue-push',
  pop: 'auto-fix-all-queue-pop',
  empty: 'auto-fix-all-queue-empty',
  list: 'auto-fix-all-queue-list'
};

/**
 * Run a command (shell or native) and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with
 *   (defaults to the current process's own environment).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd, env = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd, env });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
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
async function runPair(subcommand, shellRepo, nativeRepo, rest, { env = {}, fakeFetch = false } = {}) {
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
 * Seed a fixture directory's `.claude/state/auto-fix-all-queue.json`.
 * @param {string} repoPath - the fixture directory's path.
 * @param {string[]} ids - the queue's ids, in order.
 * @returns {Promise<void>} resolves once written.
 */
async function seedQueue(repoPath, ids) {
  const file = path.join(repoPath, '.claude', 'state', 'auto-fix-all-queue.json');

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ids.map((id) => ({ id }))));
}

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, { cwd });
}

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
async function seedGithubLikeRepo(repo) {
  await git(['remote', 'set-url', 'origin', FAKE_GITHUB_URL], repo.repoPath);
}

describe('auto-fix-all-queue-* parity (shell vs. native)', () => {
  describe('next', () => {
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
      nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');
    });

    afterEach(async () => {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    });

    it('matches shell output for a non-empty queue', async () => {
      await Promise.all([seedQueue(shellRepo, ['1', '2']), seedQueue(nativeRepo, ['1', '2'])]);

      const { shell, native } = await runPair('next', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('1\n');
    });

    it('matches shell output for an absent queue file', async () => {
      const { shell, native } = await runPair('next', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('\n');
    });
  });

  describe('wait-next', () => {
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
      nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');
    });

    afterEach(async () => {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    });

    it('matches shell output when the queue is already non-empty (resolves on the first check)', async () => {
      await Promise.all([seedQueue(shellRepo, ['7']), seedQueue(nativeRepo, ['7'])]);

      const { shell, native } = await runPair('wait-next', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('7\n');
    });
  });

  describe('pop', () => {
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
      nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');
    });

    afterEach(async () => {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    });

    it('matches shell output (exit 0, empty stdout) removing the first entry', async () => {
      await Promise.all([seedQueue(shellRepo, ['a', 'b']), seedQueue(nativeRepo, ['a', 'b'])]);

      const { shell, native } = await runPair('pop', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      const nextResult = await runPair('next', shellRepo, nativeRepo, []);

      expect(nextResult.shell.stdout).toEqual('b\n');
      expect(nextResult.native.stdout).toEqual(nextResult.shell.stdout);
    });
  });

  describe('empty', () => {
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
      nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');
    });

    afterEach(async () => {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    });

    it('matches shell exit code (0, empty stdout) for a zero-length queue', async () => {
      await Promise.all([seedQueue(shellRepo, []), seedQueue(nativeRepo, [])]);

      const { shell, native } = await runPair('empty', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });

    it('matches shell exit code (1, empty stdout) for a non-empty queue', async () => {
      await Promise.all([seedQueue(shellRepo, ['x']), seedQueue(nativeRepo, ['x'])]);

      const { shell, native } = await runPair('empty', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('list', () => {
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      shellRepo = await createTempDir('arcanum-core-afaq-parity-shell-');
      nativeRepo = await createTempDir('arcanum-core-afaq-parity-native-');
    });

    afterEach(async () => {
      await Promise.all([removeTempDir(shellRepo), removeTempDir(nativeRepo)]);
    });

    it('matches shell output for a non-empty queue', async () => {
      await Promise.all([seedQueue(shellRepo, ['a', 'b', 'c']), seedQueue(nativeRepo, ['a', 'b', 'c'])]);

      const { shell, native } = await runPair('list', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('a\nb\nc\n');
    });

    it('matches shell output ("(empty)") for a zero-length queue', async () => {
      await Promise.all([seedQueue(shellRepo, []), seedQueue(nativeRepo, [])]);

      const { shell, native } = await runPair('list', shellRepo, nativeRepo, []);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('(empty)\n');
    });
  });

  describe('save', () => {
    let fakeGh;
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      fakeGh = await createFakeGhBin();
      [shellRepo, nativeRepo] = await Promise.all([createGitFixtureRepo(), createGitFixtureRepo()]);
      await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);
    });

    afterEach(async () => {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
    });

    it('rejects with the same exit code and empty stdout when no ids are given', async () => {
      const env = { PATH: `${fakeGh.binDir}:${process.env.PATH}` };
      const { shell, native } = await runPair('save', shellRepo.repoPath, nativeRepo.repoPath, [], { env });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    });

    it('matches shell output/exit code for a successful save, with the label mutation succeeding', async () => {
      const env = {
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_LABELS: '',
        FAKE_FETCH_ISSUE_LABELS: ''
      };
      const { shell, native } = await runPair('save', shellRepo.repoPath, nativeRepo.repoPath, ['10', '20'], {
        env,
        fakeFetch: true
      });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      // `tag_mutate_add_label`/`tag_mutate_remove_label` (and their
      // native `_mutateTag` counterpart) print their own per-tag
      // success/no-op line to stdout, after the `Queue saved: ...`
      // confirmation — see AutoFixAllQueue.js#_mutateTag's doc comment.
      expect(shell.stdout).toEqual(
        'Queue saved: 10 20\n' +
        'Added tag \'enqueued\' to issue #10 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'ready_for_work\' not present on issue #10 — nothing to do.\n' +
        'Tag \'created\' not present on issue #10 — nothing to do.\n' +
        'Added tag \'enqueued\' to issue #20 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'ready_for_work\' not present on issue #20 — nothing to do.\n' +
        'Tag \'created\' not present on issue #20 — nothing to do.\n'
      );
    });

    it('matches shell output/exit code even when the label mutation fails entirely (best-effort)', async () => {
      const env = {
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_VIEW_FAIL: '1',
        FAKE_FETCH_ISSUE_VIEW_FAIL: '1'
      };
      const { shell, native } = await runPair('save', shellRepo.repoPath, nativeRepo.repoPath, ['10'], {
        env,
        fakeFetch: true
      });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('Queue saved: 10\n');
    });
  });

  describe('push', () => {
    let fakeGh;
    let shellRepo;
    let nativeRepo;

    beforeEach(async () => {
      fakeGh = await createFakeGhBin();
      [shellRepo, nativeRepo] = await Promise.all([createGitFixtureRepo(), createGitFixtureRepo()]);
      await Promise.all([
        seedGithubLikeRepo(shellRepo),
        seedGithubLikeRepo(nativeRepo),
        seedQueue(shellRepo.repoPath, ['existing']),
        seedQueue(nativeRepo.repoPath, ['existing'])
      ]);
    });

    afterEach(async () => {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
    });

    it('rejects with the same exit code and empty stdout when no ids are given', async () => {
      const env = { PATH: `${fakeGh.binDir}:${process.env.PATH}` };
      const { shell, native } = await runPair('push', shellRepo.repoPath, nativeRepo.repoPath, [], { env });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    });

    it('matches shell output/exit code for a successful push, appending to the existing queue', async () => {
      const env = {
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_LABELS: 'Ready for Work',
        FAKE_FETCH_ISSUE_LABELS: 'Ready for Work'
      };
      const { shell, native } = await runPair('push', shellRepo.repoPath, nativeRepo.repoPath, ['30'], {
        env,
        fakeFetch: true
      });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      // See the equivalent `save` test's comment: the label mutation's
      // own per-tag stdout lines follow the `Pushed: ...` confirmation.
      expect(shell.stdout).toEqual(
        'Pushed: 30\n' +
        'Added tag \'enqueued\' to issue #30 on darthjee/arcanum-queue-fixture\n' +
        'Removed tag \'ready_for_work\' from issue #30 on darthjee/arcanum-queue-fixture\n' +
        'Tag \'created\' not present on issue #30 — nothing to do.\n'
      );

      const listResult = await runPair('list', shellRepo.repoPath, nativeRepo.repoPath, []);

      expect(listResult.shell.stdout).toEqual('existing\n30\n');
      expect(listResult.native.stdout).toEqual(listResult.shell.stdout);
    });

    it('matches shell output/exit code when a label mutation\'s own gh/fetch update call fails (best-effort)', async () => {
      const env = {
        PATH: `${fakeGh.binDir}:${process.env.PATH}`,
        FAKE_GH_ISSUE_EDIT_FAIL: '1',
        FAKE_FETCH_ISSUE_EDIT_FAIL: '1',
        FAKE_GH_ISSUE_LABELS: 'Ready for Work',
        FAKE_FETCH_ISSUE_LABELS: 'Ready for Work'
      };
      const { shell, native } = await runPair('push', shellRepo.repoPath, nativeRepo.repoPath, ['30'], {
        env,
        fakeFetch: true
      });

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      // Both the `enqueued` add and the `ready_for_work` remove reach
      // (and fail at) the `gh issue edit`/`PATCH` update call, so only
      // stderr gets their failure messages; the `created` remove is a
      // no-op (label never present) and never reaches that call, so its
      // "nothing to do" line still lands on stdout.
      expect(shell.stdout).toEqual(
        'Pushed: 30\n' +
        'Tag \'created\' not present on issue #30 — nothing to do.\n'
      );
    });
  });
});
