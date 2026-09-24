import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, REPO_ROOT, runCommand } from '../utils/runCommand.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

// Shared setup for the monitor-issues parity specs (issue #586) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract". The shell side always runs the `*_shell.sh`
// implementation directly (never through its engine_dispatch shim, so
// the comparison isn't circular); the native side runs
// `core/bin/arcanum <command>`.

/** `monitor-issues/scripts/`'s path. */
export const SCRIPTS_DIR = path.join(REPO_ROOT, 'monitor-issues', 'scripts');

/**
 * Builds a pair of plain (cwd-relative) fixture directories — config.sh
 * and rewrite_queue.sh resolve their files under the cwd, with no git
 * requirement.
 * @returns {Promise<{shellDir: string, nativeDir: string, cleanup: () => Promise<unknown>}>}
 *   the pair plus a teardown.
 */
export async function createDirPair() {
  const shellDir = await createTempDir('arcanum-core-mi-parity-shell-');
  const nativeDir = await createTempDir('arcanum-core-mi-parity-native-');

  return {
    shellDir,
    nativeDir,
    cleanup: () => Promise.all([removeTempDir(shellDir), removeTempDir(nativeDir)])
  };
}

/**
 * Runs a cwd-relative subcommand on both sides: `bash <shellScript>
 * ...args` from `shellDir`, and `core/bin/arcanum <nativeCommand>
 * <nativeDir> ...args` from `nativeDir` (the leading positional the
 * shim's `--prepend-repo-path` adds).
 * @param {string} shellScript - the `*_shell.sh` file name under
 *   `monitor-issues/scripts/`.
 * @param {string} nativeCommand - the `core/bin/arcanum` command.
 * @param {{shellDir: string, nativeDir: string}} dirs - the fixture pair.
 * @param {string[]} args - the subcommand's arguments.
 * @returns {Promise<{shell: object, native: object}>} both results.
 */
export async function runCwdPair(shellScript, nativeCommand, { shellDir, nativeDir }, args) {
  const shell = await runCommand(['bash', path.join(SCRIPTS_DIR, shellScript), ...args], shellDir);
  const native = await runCommand([process.execPath, NATIVE_BIN, nativeCommand, nativeDir, ...args], nativeDir);

  return { shell, native };
}

/**
 * Writes `content` as JSON to `<dir>/<relative>`, creating parents.
 * @param {string} dir - the base directory.
 * @param {string} relative - the file path under `dir`.
 * @param {unknown} content - the JSON content.
 * @returns {Promise<void>} resolves once written.
 */
export async function writeJson(dir, relative, content) {
  const file = path.join(dir, relative);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(content));
}

/**
 * @param {string} dir - the base directory.
 * @param {string} relative - the file path under `dir`.
 * @returns {Promise<string|null>} the file's content, or `null` if absent.
 */
export async function readOptional(dir, relative) {
  try {
    return await readFile(path.join(dir, relative), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Spawns a long-running command in its own process group, resolves
 * once `isDone(stdout)` holds (or `timeoutMs` elapses), then SIGTERMs
 * the whole group and waits for the leader to exit.
 * @param {string[]} commandAndArgs - `[file, ...args]`.
 * @param {object} opts - options.
 * @param {string} opts.cwd - the working directory.
 * @param {object} opts.env - the environment.
 * @param {(stdout: string) => boolean} opts.isDone - when to stop.
 * @param {number} [opts.timeoutMs] - the safety timeout.
 * @returns {Promise<{stdout: string, stderr: string, timedOut: boolean}>}
 *   everything captured before the kill.
 */
export function runUntil([file, ...args], { cwd, env, isDone, timeoutMs = 30000 }) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd, env, detached: true });
    let stdout = '';
    let stderr = '';
    let stopped = false;
    let timedOut = false;

    const stop = () => {
      if (stopped) {
        return;
      }

      stopped = true;

      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;

      if (isDone(stdout)) {
        stop();
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut });
    });
  });
}

/**
 * Starts the native monitor loop (with the fake-fetch preload).
 * @param {string} repoPath - the fixture repo.
 * @param {object} env - the environment.
 * @param {(stdout: string) => boolean} isDone - when to stop.
 * @returns {Promise<{stdout: string, stderr: string, timedOut: boolean}>} the capture.
 */
export function runNativeMonitor(repoPath, env, isDone) {
  return runUntil(
    [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, 'monitor-issues-monitor-issues', repoPath],
    { cwd: repoPath, env, isDone }
  );
}

/**
 * Starts the shell monitor loop (`monitor_issues_shell.sh`).
 * @param {string} repoPath - the fixture repo.
 * @param {object} env - the environment.
 * @param {(stdout: string) => boolean} isDone - when to stop.
 * @returns {Promise<{stdout: string, stderr: string, timedOut: boolean}>} the capture.
 */
export function runShellMonitor(repoPath, env, isDone) {
  return runUntil(
    ['bash', path.join(SCRIPTS_DIR, 'monitor_issues_shell.sh'), repoPath],
    { cwd: repoPath, env, isDone }
  );
}

/**
 * Removes the `[<timestamp>] ` log prefixes.
 * @param {string} stdout - the captured log.
 * @returns {string} the log without timestamps.
 */
export function stripTimestamps(stdout) {
  return stdout.replace(/^\[\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\] /gm, '');
}
