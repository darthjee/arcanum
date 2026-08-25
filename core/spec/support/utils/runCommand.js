import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** The `auto-fix-all-github` shell entrypoint's script path. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'github.sh');

/** `core/bin/arcanum`'s own path — the native entrypoint dispatcher. */
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * `file://` URL for `fakeGithubApiFetchPreload.js`, suitable for
 * `node --import` to replace the native side's raw `fetch` calls to
 * `api.github.com` without touching the real network.
 */
export const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

/**
 * Run a command and capture its stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
export async function runCommand([file, ...args], cwd, env = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd, env });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
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
 * Run one subcommand on both sides — shell against `shellRepo`, native
 * against `nativeRepo` — asserting nothing itself; just returns both
 * results for the caller to assert on.
 * @param {string} subcommand - `github.sh`'s subcommand name (e.g.
 *   `pr-number`).
 * @param {string} nativeCommand - the matching `core/bin/arcanum`
 *   command name (e.g. `auto-fix-all-github-pr-number`).
 * @param {string[]} extraArgs - any arguments after `<repo_path>` (e.g.
 *   `[id]`, `[id, tag]`).
 * @param {{repoPath: string}} shellRepo - the shell side's fixture repo.
 * @param {{repoPath: string}} nativeRepo - the native side's fixture repo.
 * @param {object} shellEnv - the shell invocation's environment.
 * @param {object} nativeEnv - the native invocation's environment.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runBoth(subcommand, nativeCommand, extraArgs, shellRepo, nativeRepo, shellEnv, nativeEnv) {
  const shell = await runCommand(
    [SHELL_SCRIPT, subcommand, shellRepo.repoPath, ...extraArgs],
    shellRepo.repoPath,
    shellEnv
  );
  const native = await runCommand(
    [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, nativeCommand, nativeRepo.repoPath, ...extraArgs],
    nativeRepo.repoPath,
    nativeEnv
  );

  return { shell, native };
}
