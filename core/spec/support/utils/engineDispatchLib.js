import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from './runCommand.js';

/** `arcanum/_lib/engine_dispatch.sh`'s path — the shared dispatch guard. */
export const ENGINE_DISPATCH_LIB = path.join(REPO_ROOT, 'arcanum', '_lib', 'engine_dispatch.sh');

/**
 * The `bash -c` body: sources the lib, points the sourced
 * `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` at a fixture map (never an
 * env hook), overrides the sourced `_ENGINE_DISPATCH_INSTALL_ROOT` /
 * `_ENGINE_DISPATCH_DOCKER_IMAGE` when non-empty (empty keeps the lib
 * default), then calls the requested function with the rest of argv.
 */
const WRAPPER = [
  'source "$1"',
  '_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$2"',
  'if [[ -n "$3" ]]; then _ENGINE_DISPATCH_INSTALL_ROOT="$3"; fi',
  'if [[ -n "$4" ]]; then _ENGINE_DISPATCH_DOCKER_IMAGE="$4"; fi',
  'shift 4',
  '"$@"'
].join('; ');

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
 * @param {object} [overrides] - further sourced-variable overrides.
 * @param {string} [overrides.installRoot] - `_ENGINE_DISPATCH_INSTALL_ROOT`
 *   (empty/omitted keeps the lib default).
 * @param {string} [overrides.image] - `_ENGINE_DISPATCH_DOCKER_IMAGE`
 *   (empty/omitted keeps the lib default: resolve from the install root).
 * @param {string} [overrides.input] - when given, written to stdin.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
 */
export function runEngineDispatchFn(
  statusFile, fnAndArgs, cwd, env = process.env, { installRoot = '', image = '', input } = {}
) {
  return runCommand(
    ['bash', '-c', WRAPPER, '_', ENGINE_DISPATCH_LIB, statusFile, installRoot, image, ...fnAndArgs],
    cwd,
    env,
    input
  );
}

/**
 * Convenience over `runEngineDispatchFn` for `engine_dispatch` itself.
 * @param {string} statusFile - the fixture map path (need not exist).
 * @param {string[]} dispatchArgs - `engine_dispatch`'s own arguments
 *   (`<repo_path> <command> <shell_script> [flags...] -- <args...>`).
 * @param {string} cwd - the directory to run in.
 * @param {object} [env] - the environment to run with.
 * @param {object} [overrides] - see `runEngineDispatchFn`.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
 */
export function runEngineDispatch(statusFile, dispatchArgs, cwd, env = process.env, overrides = {}) {
  return runEngineDispatchFn(statusFile, ['engine_dispatch', ...dispatchArgs], cwd, env, overrides);
}
