import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from './runCommand.js';

/** `arcanum/_lib/engine_dispatch.sh`'s path — the shared dispatch guard. */
export const ENGINE_DISPATCH_LIB = path.join(REPO_ROOT, 'arcanum', '_lib', 'engine_dispatch.sh');

/**
 * The `bash -c` body: sources the lib, points the sourced
 * `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` at a fixture map (never an
 * env hook), then calls the requested function with the rest of argv.
 */
const WRAPPER = 'source "$1"; _ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$2"; shift 2; "$@"';

/**
 * Writes a fixture `migration-status.json` under `dir`.
 * @param {string} dir - the directory to write it in.
 * @param {object|string} map - the map, serialized as JSON; a string is
 *   written verbatim (for malformed-file cases).
 * @returns {Promise<string>} the written file's path.
 */
export async function writeStatusMap(dir, map) {
  const file = path.join(dir, 'migration-status.json');

  await writeFile(file, typeof map === 'string' ? map : JSON.stringify(map));

  return file;
}

/**
 * Runs one `engine_dispatch.sh` function in a fresh `bash` that has
 * sourced the lib with its status map overridden to `statusFile`.
 * @param {string} statusFile - the fixture map path (need not exist).
 * @param {string[]} fnAndArgs - the function name and its arguments.
 * @param {string} cwd - the directory to run in.
 * @param {object} [env] - the environment to run with.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
 */
export function runEngineDispatchFn(statusFile, fnAndArgs, cwd, env = process.env) {
  return runCommand(['bash', '-c', WRAPPER, '_', ENGINE_DISPATCH_LIB, statusFile, ...fnAndArgs], cwd, env);
}
