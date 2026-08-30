import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "arcanum-split-issue-push-sub-issues" migrated
// entrypoint (issue #260) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/push_sub_issues_shell.sh (directly, NOT
// through the arcanum-split-issue/scripts/push_sub_issues.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-push-sub-issues` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// Coverage note: mirroring arcanumSplitIssueCreateSubIssueParity_spec.js's
// own precedent, the STATUS=ok multi-file happy path (actually creating
// sub-issues on GitHub) is out of scope here — both engines ultimately
// bottom out at create_sub_issue_shell.sh -> spawn_issue.sh -> real
// curl/gh calls, which can't be exercised offline. That path (ascending
// dispatch order, CREATED= accumulation) is instead covered by
// ArcanumSplitIssuePushSubIssues_spec.js's fully fake-injected unit tests
// (node/03).
//
// The "stops at first failure" contract IS exercised here, offline and
// deterministically: push_sub_issues_shell.sh itself delegates each
// file's create call to create_sub_issue.sh (an engine_dispatch shim,
// already migrated) — setting .claude/state/arcanum-config.json's
// plan-issues.max-retry-count to 0 (with no engine.mode override, so the
// default "shell" mode applies uniformly on both sides for that nested
// dispatch) makes SpawnIssue's retry loop (shell or native) skip every
// attempt entirely and immediately fail, never touching gh/curl/fetch.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'push_sub_issues_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const ISSUE_ID = '999';

/**
 * Run an arcanum-split-issue-push-sub-issues invocation (shell or native)
 * and capture its stdout/stderr/exit code.
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
 * @param {string[]} args - the `<repo_path> <issue_id>` arguments to pass
 *   to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'arcanum-split-issue-push-sub-issues', ...args],
    cwd
  );

  return { shell, native };
}

/**
 * Writes a sub-issue draft file at
 * `<repoPath>/docs/agents/issues/<issueId>_<count>_<slug>.md` and returns
 * its `docs/agents/issues/...`-relative path.
 * @param {string} repoPath - the target repo's local checkout path.
 * @param {string} issueId - the parent issue's numeric id.
 * @param {string} count - the zero-padded count segment (e.g. `'01'`).
 * @param {string} slug - the filename slug.
 * @param {string} content - the draft file's full contents.
 * @returns {Promise<string>} the written file's `docs/agents/issues/...`
 *   relative path.
 */
async function writeSubIssueFile(repoPath, issueId, count, slug, content) {
  const issuesDir = path.join(repoPath, 'docs', 'agents', 'issues');

  await mkdir(issuesDir, { recursive: true });

  const fileName = `${issueId}_${count}_${slug}.md`;

  await writeFile(path.join(issuesDir, fileName), content);

  return path.posix.join('docs', 'agents', 'issues', fileName);
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
  await seedOriginUrl(repoPath, 'https://github.com/darthjee/arcanum-pssi-fixture.git');

  const stateDir = path.join(repoPath, '.claude', 'state');

  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, 'arcanum-config.json'),
    JSON.stringify({ 'plan-issues': { 'max-retry-count': 0 } })
  );
}

describe('arcanum-split-issue-push-sub-issues parity (shell vs. native)', () => {
  describe('zero matching files', () => {
    it('matches shell STATUS=ok/CREATED= and exit code for an empty issues directory', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\nCREATED=\n');
      } finally {
        await repo.cleanup();
      }
    });

    it('matches shell STATUS=ok/CREATED= and exit code when only non-matching files are present', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const issuesDir = path.join(repo.repoPath, 'docs', 'agents', 'issues');

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, 'unrelated.md'), 'not a sub-issue draft\n');

        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\nCREATED=\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('the "stops at first failure" contract (plan-issues.max-retry-count: 0)', () => {
    it('matches shell STATUS=failed/CREATED=/FAILED= and exit code, stopping after the first of 2+ files', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedZeroRetryRepo(shellRepo.repoPath), seedZeroRetryRepo(nativeRepo.repoPath)]);

        const shellFirstFile = await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '01',
          'first_sub_issue',
          '# First Sub Issue\n\nBody content here.\n'
        );

        await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '02',
          'second_sub_issue',
          '# Second Sub Issue\n\nBody content here.\n'
        );

        const nativeFirstFile = await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '01',
          'first_sub_issue',
          '# First Sub Issue\n\nBody content here.\n'
        );

        await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '02',
          'second_sub_issue',
          '# Second Sub Issue\n\nBody content here.\n'
        );

        expect(shellFirstFile).toEqual(nativeFirstFile);

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ISSUE_ID], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-push-sub-issues', nativeRepo.repoPath, ISSUE_ID],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual(`STATUS=failed\nCREATED=\nFAILED=${shellFirstFile}\n`);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('a present-but-non-directory repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-pssi-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth([missingPath, ISSUE_ID], cwd);

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a non-git repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-pssi-parity-');

      try {
        const { shell, native } = await runBoth([cwd, ISSUE_ID], cwd);

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});
