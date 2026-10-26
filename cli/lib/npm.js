// Runs npm for `arcanum self-update` (see
// docs/agents/architecture/arcanum-cli.md#self-update): always through
// `execFile` with an argument array (no shell), with every byte of
// output captured, never inherited. A failure is classified into an
// `NpmError` (or an `InterruptedError` on Ctrl-C) whose `category` the
// caller words per call.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { InterruptedError, NpmError } from './exitCodes.js';

const defaultExecFileAsync = promisify(execFile);

/** How many trailing lines of npm's stderr a failure keeps. */
export const NPM_OUTPUT_LINES = 10;

const NPM_ERROR_CODE = /npm (?:error|ERR!) code (\S+)/;
const PERMISSION_CODES = ['EACCES', 'EPERM'];
const NETWORK_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET'];

/**
 * @param {string} stderr - npm's captured stderr.
 * @returns {(string|null)} its last `NPM_OUTPUT_LINES` non-empty lines,
 *   or `null` when there are none.
 */
export function lastLines(stderr) {
  const lines = String(stderr || '').split('\n').filter((line) => line.trim() !== '');

  return lines.length === 0 ? null : lines.slice(-NPM_OUTPUT_LINES).join('\n');
}

/**
 * @param {string} stderr - npm's captured stderr.
 * @returns {(string|null)} the error code npm printed (`npm error code
 *   EACCES` on npm 9+, `npm ERR! code EACCES` before), if any.
 */
export function npmErrorCode(stderr) {
  const match = NPM_ERROR_CODE.exec(String(stderr || ''));

  return match ? match[1] : null;
}

/**
 * @param {(string|null)} code - npm's error code.
 * @returns {string} `permission`, `not_found`, `network` or `failed`.
 */
function categoryOf(code) {
  if (PERMISSION_CODES.includes(code)) {
    return 'permission';
  }

  if (code === 'E404') {
    return 'not_found';
  }

  if (NETWORK_CODES.includes(code) || (typeof code === 'string' && code.startsWith('ERR_SOCKET'))) {
    return 'network';
  }

  return 'failed';
}

/**
 * Classifies a rejected `execFile('npm', ...)` call.
 * @param {string[]} args - npm's arguments.
 * @param {object} error - the `execFile` rejection.
 * @returns {(NpmError|InterruptedError)} the classified error.
 */
export function classifyNpmError(args, error) {
  const command = `npm ${args.join(' ')}`;
  const npmOutput = lastLines(error.stderr);

  if (error.code === 'ENOENT') {
    return new NpmError('npm not found on PATH', {
      hint: 'install Node.js and npm, then run it again', category: 'not_installed'
    });
  }

  // npm traps SIGINT and exits 130 itself; an untrapped child dies by the signal.
  if (error.signal === 'SIGINT' || error.code === 130) {
    return new InterruptedError(`${command} was interrupted`);
  }

  if (error.killed && error.signal === 'SIGTERM') {
    return new NpmError(`${command} timed out`, { npmOutput, category: 'timeout' });
  }

  const npmExit = typeof error.code === 'number' ? error.code : null;
  const category = categoryOf(npmErrorCode(error.stderr));

  return new NpmError(`${command} failed (exit ${npmExit === null ? 'unknown' : npmExit})`, {
    npmOutput, category, npmExit
  });
}

/**
 * Runs npm with captured output and no shell.
 * @param {string[]} args - npm's arguments, passed through unchanged.
 * @param {object} [options] - run options.
 * @param {number} [options.timeout] - a process timeout in ms (`0` or
 *   unset: none).
 * @param {(file: string, args: string[], options: object) => Promise<{stdout: string, stderr: string}>} [options.execFileAsync]
 *   - promisified `execFile`, injectable for testing.
 * @returns {Promise<{stdout: string, stderr: string}>} npm's output.
 * @throws {NpmError} (exit `8`) on any npm failure, with its `category`.
 * @throws {InterruptedError} (exit `130`) when npm got a `SIGINT`.
 */
export async function runNpm(args, { timeout = 0, execFileAsync = defaultExecFileAsync } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('npm', args, { timeout });

    return { stdout: String(stdout), stderr: String(stderr) };
  } catch (error) {
    throw classifyNpmError(args, error);
  }
}
