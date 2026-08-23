import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "arcanum-update-run-update-check" /
// "arcanum-update-run-update-apply" migrated entrypoints (issue #263) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md's
// "Shared contracts". Runs
// arcanum-update/scripts/run_update_check_shell.sh /
// run_update_apply_shell.sh directly (NOT through run_update.sh's
// engine_dispatch shim, so this isn't circular) and `core/bin/arcanum
// arcanum-update-run-update-check`/`-apply` against identically-seeded
// fixture arcanum installs, asserting byte-identical stdout and exit
// code for both. `apply`'s fixtures use a deterministic stub
// arcanum/update/bootstrap.sh (see
// core/spec/support/fixtures/arcanum_update_bootstrap_stub.sh) instead
// of the real one, so no real network install is ever attempted.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'arcanum-update', 'scripts');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const BOOTSTRAP_STUB = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'support',
  'fixtures',
  'arcanum_update_bootstrap_stub.sh'
);

const SHELL_SCRIPTS = {
  check: path.join(SCRIPTS_DIR, 'run_update_check_shell.sh'),
  apply: path.join(SCRIPTS_DIR, 'run_update_apply_shell.sh')
};

const NATIVE_COMMANDS = {
  check: 'arcanum-update-run-update-check',
  apply: 'arcanum-update-run-update-apply'
};

/**
 * Run a command (shell or native) and capture its stdout/stderr/exit code.
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
 * @param {'check'|'apply'} subcommand - which subcommand to run.
 * @param {string} targetPath - the fixture arcanum install's path
 *   (passed as-is to both sides — this entrypoint never `cd`s).
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runPair(subcommand, targetPath, cwd) {
  const shell = await runCommand([SHELL_SCRIPTS[subcommand], targetPath], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, NATIVE_COMMANDS[subcommand], targetPath], cwd);

  return { shell, native };
}

/**
 * Copy the deterministic bootstrap stub into `<dir>/arcanum/update/bootstrap.sh`,
 * made executable.
 * @param {string} dir - the fixture root.
 * @returns {Promise<void>} resolves once written.
 */
async function installBootstrapStub(dir) {
  const bootstrapDir = path.join(dir, 'arcanum', 'update');

  await mkdir(bootstrapDir, { recursive: true });

  const stubContent = await readFile(BOOTSTRAP_STUB, 'utf8');
  const bootstrapPath = path.join(bootstrapDir, 'bootstrap.sh');

  await writeFile(bootstrapPath, stubContent);
  await chmod(bootstrapPath, 0o755);
}

/**
 * Build a `zip`-method fixture: a temp dir with a stub
 * `arcanum/update/bootstrap.sh` and an `arcanum.json` seeded with
 * `repo`/`version`.
 * @param {string} prefix - the temp-dir prefix.
 * @param {object} [opts] - options.
 * @param {string} [opts.repo] - `arcanum.json`'s `.repo` field.
 * @param {string} [opts.version] - `arcanum.json`'s `.version` field.
 * @returns {Promise<string>} the fixture's root path.
 */
async function createZipFixture(prefix, { repo = 'darthjee/arcanum-fixture', version = '1.0.0' } = {}) {
  const dir = await createTempDir(prefix);

  await installBootstrapStub(dir);
  await writeFile(path.join(dir, 'arcanum.json'), JSON.stringify({ repo, version }));

  return dir;
}

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 't@example.com'
    }
  });
}

/**
 * Build a `git`-method fixture: a temp dir with a stub
 * `arcanum/update/bootstrap.sh`, a git repo with a `git@github.com:...`
 * `origin` remote, and one commit, optionally tagged.
 * @param {string} prefix - the temp-dir prefix.
 * @param {object} [opts] - options.
 * @param {boolean} [opts.tagged] - whether to tag the seed commit
 *   `v1.0.0` (exercising the exact-tag-match `CURRENT` path), or leave
 *   it untagged (exercising the short-commit-hash fallback).
 * @returns {Promise<string>} the fixture's root path.
 */
async function createGitFixture(prefix, { tagged = false } = {}) {
  const dir = await createTempDir(prefix);

  await installBootstrapStub(dir);
  await git(['init', '--quiet', '-b', 'main', dir], dir);
  await git(['config', 'commit.gpgsign', 'false'], dir);
  await writeFile(path.join(dir, 'README.md'), '# fixture\n');
  await git(['add', 'README.md'], dir);
  await git(['commit', '--quiet', '-m', 'seed'], dir);

  if (tagged) {
    await git(['tag', 'v1.0.0'], dir);
  }

  await git(['remote', 'add', 'origin', 'git@github.com:darthjee/arcanum-fixture.git'], dir);

  return dir;
}

describe('arcanum-update-run-update-check/-apply parity (shell vs. native)', () => {
  describe('check', () => {
    it('matches shell output for the zip method', async () => {
      const dir = await createZipFixture('arcanum-core-aurru-parity-check-zip-', {
        repo: 'darthjee/arcanum-fixture',
        version: '1.0.0'
      });

      try {
        const { shell, native } = await runPair('check', dir, dir);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(`METHOD=zip\nREPO=darthjee/arcanum-fixture\nCURRENT=1.0.0\nTARGET=${dir}\n`);
      } finally {
        await removeTempDir(dir);
      }
    });

    it('matches shell output for the git method with an exact tag on HEAD', async () => {
      const dir = await createGitFixture('arcanum-core-aurru-parity-check-git-tagged-', { tagged: true });

      try {
        const { shell, native } = await runPair('check', dir, dir);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(
          `METHOD=git\nREPO=darthjee/arcanum-fixture\nCURRENT=v1.0.0\nTARGET=${dir}\n`
        );
      } finally {
        await removeTempDir(dir);
      }
    });

    it('matches shell output for the git method falling back to the short commit hash', async () => {
      const dir = await createGitFixture('arcanum-core-aurru-parity-check-git-untagged-', { tagged: false });

      try {
        const { shell, native } = await runPair('check', dir, dir);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toMatch(
          new RegExp(`^METHOD=git\\nREPO=darthjee/arcanum-fixture\\nCURRENT=[0-9a-f]{7,}\\nTARGET=${dir}\\n$`)
        );
      } finally {
        await removeTempDir(dir);
      }
    });

    it('matches shell output (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent', async () => {
      const dir = await createTempDir('arcanum-core-aurru-parity-check-missing-');

      try {
        const { shell, native } = await runPair('check', dir, dir);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('STATUS=missing_arcanum\n');
      } finally {
        await removeTempDir(dir);
      }
    });
  });

  describe('apply', () => {
    it('matches shell output (RESULT=updated) when bootstrap.sh bumps the version', async () => {
      const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-', { version: '1.0.0' });
      const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-', { version: '1.0.0' });

      try {
        await writeFile(path.join(shellDir, '.fixture-new-version'), '1.1.0');
        await writeFile(path.join(nativeDir, '.fixture-new-version'), '1.1.0');

        const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
          nativeDir
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('bootstrap: starting\nbootstrap: done\nRESULT=updated FROM=1.0.0 TO=1.1.0\n');
      } finally {
        await removeTempDir(shellDir);
        await removeTempDir(nativeDir);
      }
    });

    it('matches shell output (RESULT=noop) when bootstrap.sh does not change the version', async () => {
      const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-noop-', { version: '1.0.0' });
      const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-noop-', { version: '1.0.0' });

      try {
        const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
          nativeDir
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('bootstrap: starting\nbootstrap: done\nRESULT=noop VERSION=1.0.0\n');
      } finally {
        await removeTempDir(shellDir);
        await removeTempDir(nativeDir);
      }
    });

    it('matches shell output and exit code when bootstrap.sh fails, printing nothing further', async () => {
      const shellDir = await createZipFixture('arcanum-core-aurru-parity-apply-shell-fail-', { version: '1.0.0' });
      const nativeDir = await createZipFixture('arcanum-core-aurru-parity-apply-native-fail-', { version: '1.0.0' });

      try {
        await writeFile(path.join(shellDir, '.fixture-fail'), '9');
        await writeFile(path.join(nativeDir, '.fixture-fail'), '9');

        const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir],
          nativeDir
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(9);
        expect(shell.stdout).toEqual('bootstrap: starting\n');
      } finally {
        await removeTempDir(shellDir);
        await removeTempDir(nativeDir);
      }
    });

    it('matches shell output (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent', async () => {
      const dir = await createTempDir('arcanum-core-aurru-parity-apply-missing-');

      try {
        const { shell, native } = await runPair('apply', dir, dir);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('STATUS=missing_arcanum\n');
      } finally {
        await removeTempDir(dir);
      }
    });
  });
});
