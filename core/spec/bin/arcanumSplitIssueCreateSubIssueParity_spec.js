import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "arcanum-split-issue-create-sub-issue" migrated
// entrypoint (issue #259) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/create_sub_issue_shell.sh (directly, NOT
// through the arcanum-split-issue/scripts/create_sub_issue.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-create-sub-issue` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// Coverage note: mirroring spawnIssueParity_spec.js's /
// githubIssueCreateParity_spec.js's own precedent, the STATUS=ok happy
// path is NOT exercised here. create_sub_issue_shell.sh delegates the
// actual GitHub work to arcanum/_lib/spawn_issue.sh — itself an
// engine_dispatch shim (spawn-issue is already migrated) — which in shell
// mode ultimately shells out to `curl` (via github_issue_shell.sh's
// cmd_create), a real network call that can't be intercepted the way
// `gh` is (no PATH-swappable binary) without either touching the real
// network or editing arcanum/_lib/spawn_issue.sh's own env-var allowlist
// (out of this agent's scope — see docs/agents/architecture/script-engine.md).
// The happy path is instead covered by
// ArcanumSplitIssueCreateSubIssue_spec.js's fully fake-injected unit
// tests (node/03).
//
// The retry-exhausted failure path IS exercised here, offline and
// deterministically: setting .claude/state/arcanum-config.json's
// plan-issues.max-retry-count to 0 makes both the shell implementation's
// retry `while` loop and SpawnIssue.js's own retry `for` loop skip every
// attempt entirely (never touching gh/curl/fetch) and immediately print
// STATUS=failed — this also happens to reveal that create_sub_issue_shell.sh
// prints STATUS=failed TWICE on this path (it echoes spawn_issue.sh's own
// STATUS=failed verbatim, then appends its own STATUS=failed on top), a
// quirk the native module now reproduces exactly (see the "fix" commit on
// this issue for the discovery).

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'create_sub_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const ISSUE_ID = '999';

/**
 * Run an arcanum-split-issue-create-sub-issue invocation (shell or
 * native) and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * @param {string[]} args - the `<repo_path> <issue_id> <sub_issue_file>`
 *   arguments to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue', ...args],
    cwd
  );

  return { shell, native };
}

/**
 * Writes a sub-issue draft file at
 * `<repoPath>/docs/agents/issues/<issueId>_<count>_<slug>.md` and
 * returns its absolute path.
 * @param {string} repoPath - the target repo's local checkout path.
 * @param {string} issueId - the parent issue's numeric id.
 * @param {string} count - the zero-padded count segment (e.g. `'01'`).
 * @param {string} slug - the filename slug.
 * @param {string} content - the draft file's full contents.
 * @returns {Promise<string>} the written file's absolute path.
 */
async function writeSubIssueFile(repoPath, issueId, count, slug, content) {
  const issuesDir = path.join(repoPath, 'docs', 'agents', 'issues');

  await mkdir(issuesDir, { recursive: true });

  const filePath = path.join(issuesDir, `${issueId}_${count}_${slug}.md`);

  await writeFile(filePath, content);

  return filePath;
}

/**
 * Sets `origin` to a github.com-shaped URL (satisfying Origin.js's/
 * origin.sh's domain/repo parsing — no real network involved, nothing
 * ever pushes/fetches against it in this flow) and writes a
 * `plan-issues.max-retry-count: 0` repo-local config, so SpawnIssue's
 * retry loop (shell or native) is skipped entirely, never touching
 * gh/curl/fetch.
 * @param {string} repoPath - the target repo's local checkout path.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedZeroRetryRepo(repoPath) {
  await seedOriginUrl(repoPath, 'https://github.com/darthjee/arcanum-cs-fixture.git');

  const stateDir = path.join(repoPath, '.claude', 'state');

  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, 'arcanum-config.json'),
    JSON.stringify({ 'plan-issues': { 'max-retry-count': 0 } })
  );
}

describe('arcanum-split-issue-create-sub-issue parity (shell vs. native)', () => {
  describe('a missing <repo_path> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const { shell, native } = await runBoth(['', ISSUE_ID, '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a missing <issue_id> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <sub_issue_file> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID, ''], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a repo_path that is not a directory', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');

        const { shell, native } = await runBoth([missingPath, ISSUE_ID, '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a repo_path that is not a git repository', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const { shell, native } = await runBoth([cwd, ISSUE_ID, '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a sub_issue_file that does not exist', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const missingFile = path.join(repo.repoPath, 'docs', 'agents', 'issues', 'missing.md');

        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID, missingFile], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingFile}`);
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('the retry-exhausted failure path (plan-issues.max-retry-count: 0)', () => {
    it('matches shell exit code and the doubled STATUS=failed stdout, prefixed by the progress line', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedZeroRetryRepo(shellRepo.repoPath), seedZeroRetryRepo(nativeRepo.repoPath)]);

        const shellFile = await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '01',
          'my_sub_issue',
          '# My Sub Issue\n\nBody content here.\n'
        );
        const nativeFile = await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '01',
          'my_sub_issue',
          '# My Sub Issue\n\nBody content here.\n'
        );

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ISSUE_ID, shellFile], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue', nativeRepo.repoPath, ISSUE_ID, nativeFile],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual(
          `Creating sub-issue 01 for issue #${ISSUE_ID}: My Sub Issue\nSTATUS=failed\nSTATUS=failed\n`
        );
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });
});
