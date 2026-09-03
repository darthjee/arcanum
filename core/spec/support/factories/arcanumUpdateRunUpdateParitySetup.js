import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir } from '../utils/tempDir.js';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'arcanum-update', 'scripts');
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const BOOTSTRAP_STUB = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'arcanum_update_bootstrap_stub.sh'
);

export const SHELL_SCRIPTS = {
  check: path.join(SCRIPTS_DIR, 'run_update_check_shell.sh'),
  apply: path.join(SCRIPTS_DIR, 'run_update_apply_shell.sh')
};

export const NATIVE_COMMANDS = {
  check: 'arcanum-update-run-update-check',
  apply: 'arcanum-update-run-update-apply'
};

/**
 * Run a command (shell or native) and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
export async function runCommand([file, ...args], cwd) {
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
export async function runPair(subcommand, targetPath, cwd) {
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
export async function installBootstrapStub(dir) {
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
export async function createZipFixture(prefix, { repo = 'darthjee/arcanum-fixture', version = '1.0.0' } = {}) {
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
export async function git(args, cwd) {
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
export async function createGitFixture(prefix, { tagged = false } = {}) {
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
