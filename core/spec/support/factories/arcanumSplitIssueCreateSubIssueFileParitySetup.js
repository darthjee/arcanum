import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const SHELL_SCRIPT = path.join(
  REPO_ROOT,
  'arcanum-split-issue',
  'scripts',
  'create_sub_issue_file_shell.sh'
);
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a arcanum-split-issue-create-sub-issue-file invocation (shell or
 * native) and capture its stdout/stderr/exit code.
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
 * @param {string[]} args - the `<repo_path> <issue_id> <title>
 *   <body_file>` arguments to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue-file', ...args],
    cwd
  );

  return { shell, native };
}
