import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const execFileAsync = promisify(execFile);

// Contract spec for the `2.3.0/001` global migration that installs the
// `arcanum-cli` npm package pinned to the installed arcanum version
// (issue #872). The migration path is one full string literal so
// `scripts/bump-version.sh` can rewrite it on release; `MANIFEST` and
// `SCRIPT_RELATIVE` are both derived from `SCRIPT`, so they follow it.
// NOT a parity spec: the migration script has no native counterpart.
//
// Each case builds a fake install in a temp dir: a copy of the real
// `001.sh` at `<install>/arcanum/migrations/repos/2.3.0/001.sh` and a
// stub `<install>/arcanum/_lib/install_cli.sh` that records its
// arguments, writes a line to stderr (to prove the migration folds it
// into stdout) and exits with `$STUB_EXIT` (default 0). The copy runs
// from an unrelated cwd, proving its paths come from its own location.
// Neither the stub nor `run` ever opens `/dev/tty`, so no detached
// session is needed.

const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/2.3.0/001.sh');
const MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json');
const SCRIPT_RELATIVE = path.relative(REPO_ROOT, SCRIPT);
const STUB_RELATIVE = path.join('arcanum', '_lib', 'install_cli.sh');
const STUB_STDERR_LINE = 'install_cli stub: stderr line';
const STUB_SOURCE = [
  '#!/usr/bin/env bash',
  'echo "$*" >> "$STUB_RECORD"',
  `echo '${STUB_STDERR_LINE}' >&2`,
  'exit "${STUB_EXIT:-0}"',
  ''
].join('\n');

/**
 * @returns {object} `process.env` without any variable that would point
 *   `git` at the outer arcanum checkout.
 */
function cleanGitEnv() {
  const env = { ...process.env };

  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;

  return env;
}

/**
 * Run `git` in `cwd` with a clean git env and a fixed identity.
 * @param {string[]} args - the `git` arguments.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, { cwd, env: cleanGitEnv() });
}

/**
 * Turn `installRoot` into a git repo with a single commit, optionally
 * tagged.
 * @param {string} installRoot - the fake install root.
 * @param {string} [tag] - the tag to put on HEAD, if any.
 * @returns {Promise<void>} resolves once committed (and tagged).
 */
async function initGitInstall(installRoot, tag) {
  await git(['init', '--quiet'], installRoot);
  await git(['config', 'user.email', 'test@example.com'], installRoot);
  await git(['config', 'user.name', 'Test'], installRoot);
  await git(['config', 'commit.gpgsign', 'false'], installRoot);
  await git(['config', 'tag.gpgsign', 'false'], installRoot);
  await git(['add', '.'], installRoot);
  await git(['commit', '--quiet', '-m', 'install'], installRoot);

  if (tag) {
    await git(['tag', tag], installRoot);
  }
}

describe('2.3.0/001 arcanum-cli install migration', () => {
  let installRoot;
  let workDir;
  let recordFile;
  let scriptCopy;

  /**
   * Run the copied migration from the unrelated `workDir`.
   * @param {string[]} args - the migration's arguments.
   * @param {object} [extraEnv] - variables added to the environment.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  async function runMigration(args, extraEnv = {}) {
    const env = {
      ...cleanGitEnv(),
      GIT_CEILING_DIRECTORIES: path.dirname(installRoot),
      STUB_RECORD: recordFile,
      ...extraEnv
    };

    try {
      const { stdout, stderr } = await execFileAsync(scriptCopy, args, { cwd: workDir, env });

      return { stdout, stderr, code: 0 };
    } catch (error) {
      return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
    }
  }

  /**
   * @returns {Promise<string[]>} each recorded stub call's arguments.
   */
  async function stubCalls() {
    try {
      const content = await readFile(recordFile, 'utf8');

      return content.split('\n').filter((line) => line !== '');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * @param {object} content - written as the install's `arcanum.json`.
   * @returns {Promise<void>} resolves once written.
   */
  async function writeArcanumJson(content) {
    await writeFile(path.join(installRoot, 'arcanum.json'), JSON.stringify(content));
  }

  beforeEach(async () => {
    installRoot = await createTempDir('arcanum-core-cli-install-migration-install-');
    workDir = await createTempDir('arcanum-core-cli-install-migration-cwd-');
    recordFile = path.join(workDir, 'stub-calls.txt');
    scriptCopy = path.join(installRoot, SCRIPT_RELATIVE);

    const stubPath = path.join(installRoot, STUB_RELATIVE);

    await mkdir(path.dirname(scriptCopy), { recursive: true });
    await mkdir(path.dirname(stubPath), { recursive: true });
    await copyFile(SCRIPT, scriptCopy);
    await chmod(scriptCopy, 0o755);
    await writeFile(stubPath, STUB_SOURCE);
    await chmod(stubPath, 0o755);
  });

  afterEach(async () => {
    await Promise.all([removeTempDir(installRoot), removeTempDir(workDir)]);
  });

  describe('config', () => {
    it('prints {"skippable": true} and exits 0', async () => {
      const result = await runMigration(['config']);

      expect(result.code).toEqual(0);
      expect(JSON.parse(result.stdout)).toEqual({ skippable: true });
    });
  });

  describe('usage', () => {
    it('rejects an unknown subcommand with usage on stderr', async () => {
      const result = await runMigration(['bogus']);

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain('Usage:');
    });

    it('rejects a missing subcommand with usage on stderr', async () => {
      const result = await runMigration([]);

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain('Usage:');
    });
  });

  describe('run', () => {
    describe('when arcanum.json holds a version', () => {
      beforeEach(async () => {
        await writeArcanumJson({ version: '2.3.0' });
      });

      it('calls the shared script once with that version and --no-confirm', async () => {
        await runMigration(['run']);

        expect(await stubCalls()).toEqual(['2.3.0 --no-confirm']);
      });

      it('folds the shared script stderr into stdout and exits 0', async () => {
        const result = await runMigration(['run']);

        expect(result.code).toEqual(0);
        expect(result.stdout).toContain(STUB_STDERR_LINE);
        expect(result.stderr).toEqual('');
      });

      [1, 4].forEach((stubExit) => {
        it(`still exits 0 when the shared script exits ${stubExit}`, async () => {
          const result = await runMigration(['run'], { STUB_EXIT: String(stubExit) });

          expect(result.code).toEqual(0);
          expect(await stubCalls()).toEqual(['2.3.0 --no-confirm']);
        });
      });
    });

    describe('when there is no arcanum.json and HEAD carries an exact tag', () => {
      beforeEach(async () => {
        await initGitInstall(installRoot, '2.3.0');
      });

      it('calls the shared script once with the tag and --no-confirm, exiting 0', async () => {
        const result = await runMigration(['run']);

        expect(result.code).toEqual(0);
        expect(result.stdout).toContain(STUB_STDERR_LINE);
        expect(await stubCalls()).toEqual(['2.3.0 --no-confirm']);
      });
    });

    describe('when there is no arcanum.json and HEAD is untagged', () => {
      beforeEach(async () => {
        await initGitInstall(installRoot);
      });

      it('warns on stdout with the manual command, skips the call and exits 0', async () => {
        const result = await runMigration(['run']);

        expect(result.code).toEqual(0);
        expect(result.stdout).toContain('npm i -g arcanum-cli');
        expect(await stubCalls()).toEqual([]);
      });
    });

    describe('when there is neither arcanum.json nor git', () => {
      it('warns on stdout with the manual command, skips the call and exits 0', async () => {
        const result = await runMigration(['run']);

        expect(result.code).toEqual(0);
        expect(result.stdout).toContain('npm i -g arcanum-cli');
        expect(await stubCalls()).toEqual([]);
      });
    });
  });

  describe('migrations.json', () => {
    it('declares exactly the skippable global 001 script entry', async () => {
      const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

      expect(manifest).toEqual([
        { id: '001', type: 'script', file: '001.sh', skippable: true, applies_to: 'global' }
      ]);
    });
  });
});
