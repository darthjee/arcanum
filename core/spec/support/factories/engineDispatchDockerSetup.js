import { chmod, mkdir, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { runEngineDispatch, writeStatusMap } from '../utils/engineDispatchLib.js';
import { REPO_ROOT, git } from '../utils/runCommand.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

// Shared setup for the docker cases of
// core/spec/bin/engineDispatchDocker_spec.js (see
// docs/agents/specs/docker/testing.md -> "Dispatch-level specs").

/** `auto-fix-all-config-get`'s shell twin: prints the key's value. */
export const SHELL_TWIN = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'config_get_shell.sh');

/** A dual command whose shell and native sides both print `true\n`. */
export const CONFIG_GET = 'auto-fix-all-config-get';

/** A dual command whose native side always crashes (shell prints `true\n`). */
export const CRASH = 'dispatch-fixture-crash';

/** The image ref most cases pin via `_ENGINE_DISPATCH_DOCKER_IMAGE`. */
export const IMAGE = 'darthjee/arcanum:9.9.9-spec';

/** `docker run` flags whose next token is their value. */
const VALUE_FLAGS = new Set(['--label', '--user', '--tmpfs', '--cap-drop', '--security-opt', '-w', '-v', '-e']);

/**
 * @param {string} command - the dispatched command.
 * @returns {string} the row-3 ("not docker-ready yet") warning line.
 */
export function notDockerReadyWarning(command) {
  return `Warning: '${command}' is not docker-ready yet (arcanum/_lib/migration-status.json) — ` +
    'falling back to the native implementation on the host.\n';
}

/**
 * @param {string} command - the dispatched command.
 * @returns {string} the row-3b ("no native implementation") warning line.
 */
export function noNativeWarning(command) {
  return `Warning: no native implementation of '${command}' yet (arcanum/_lib/migration-status.json) — ` +
    'falling back to the shell implementation.\n';
}

/**
 * @param {string} reason - the unavailability reason.
 * @param {string} command - the dispatched command.
 * @returns {string} the row-4 ("Docker is unavailable") warning line.
 */
export function dockerUnavailableWarning(reason, command) {
  return `Warning: Docker is unavailable (${reason}) — running '${command}' natively on the host. ` +
    'Fix Docker or change engine.mode.\n';
}

/**
 * @param {string} repoPath - the repo path.
 * @returns {string[]} the fixed `docker run` flags, in contract order,
 *   ending with the repo mount.
 */
export function fixedRunFlags(repoPath) {
  return [
    '--rm', '-i', '--init',
    '--label', 'arcanum.dispatch=1',
    '--user', `${process.getuid()}:${process.getgid()}`,
    '--read-only', '--tmpfs', '/tmp:rw,exec,mode=1777',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '-w', repoPath,
    '-v', `${repoPath}:${repoPath}`
  ];
}

/**
 * Splits one logged `docker run` argv into its parts.
 * @param {string[]} argv - the argv after `docker` (starting with `run`).
 * @returns {{flags: string[], image: string, after: string[], mounts: string[], envNames: string[]}}
 *   the flags before the image, the image ref, the arguments after it,
 *   and every `-v` / `-e` value, in order.
 */
export function splitRunArgv(argv) {
  const opts = argv.slice(1);
  const mounts = [];
  const envNames = [];
  let index = 0;

  while (index < opts.length && opts[index].startsWith('-')) {
    if (VALUE_FLAGS.has(opts[index])) {
      if (opts[index] === '-v') mounts.push(opts[index + 1]);
      if (opts[index] === '-e') envNames.push(opts[index + 1]);
      index += 1;
    }
    index += 1;
  }

  return {
    flags: opts.slice(0, index),
    image: opts[index],
    after: opts.slice(index + 1),
    mounts,
    envNames
  };
}

/**
 * @param {object[]} calls - the fake docker's logged calls.
 * @returns {string[]} each call's subcommand (`inspect` for `image inspect`).
 */
export function subcommands(calls) {
  return calls.map(({ argv }) => (argv[0] === 'image' ? argv[1] : argv[0]));
}

/**
 * @param {object[]} calls - the fake docker's logged calls.
 * @returns {object[]} only the `run` calls.
 */
export function runCalls(calls) {
  return calls.filter(({ argv }) => argv[0] === 'run');
}

/**
 * @param {object} env - a logged `run` call's `env` (name -> value).
 * @returns {Array<[string, string]>} its `GIT_CONFIG_KEY_<n>` /
 *   `GIT_CONFIG_VALUE_<n>` pairs, for n < `GIT_CONFIG_COUNT`.
 */
export function gitConfigPairs(env) {
  const count = Number(env.GIT_CONFIG_COUNT ?? 0);

  return Array.from({ length: count }, (_, n) => [env[`GIT_CONFIG_KEY_${n}`], env[`GIT_CONFIG_VALUE_${n}`]]);
}

/**
 * Writes `.claude/state/arcanum-config.json` with `engine.mode=docker`
 * plus any extra `engine` keys (e.g. `log`).
 * @param {string} repoPath - the repo.
 * @param {object} [engine] - extra `engine` keys.
 * @param {string} [mode] - the engine mode (default `docker`).
 * @returns {Promise<void>} resolves once written.
 */
export async function seedEngineConfig(repoPath, engine = {}, mode = 'docker') {
  const dir = path.join(repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode, ...engine } }));
}

/**
 * Makes `repoPath` a git repo (unless it already is one) carrying the
 * repo config `auto-fix-all-config-get <repo> auto_merge` reads.
 * @param {string} repoPath - the directory.
 * @returns {Promise<void>} resolves once ready.
 */
export async function seedRepo(repoPath) {
  await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
  if (!existsSync(path.join(repoPath, '.git'))) {
    await git(['init', '-q'], repoPath);
  }
  await writeFile(
    path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
    JSON.stringify({ 'auto-fix-all': { auto_merge: true } })
  );
}

/**
 * Builds a `PATH` with no `docker` on it: every directory of the current
 * `PATH` that holds a `docker` is replaced by a directory of symlinks to
 * its other entries, so every other tool stays reachable.
 * @param {string} dir - a scratch directory to build the replacement in.
 * @returns {Promise<string>} the `PATH` value.
 */
export async function pathWithoutDocker(dir) {
  const entries = [];

  for (const [index, entry] of (process.env.PATH || '').split(path.delimiter).entries()) {
    if (!entry || !existsSync(path.join(entry, 'docker'))) {
      entries.push(entry);
      continue;
    }
    const replacement = path.join(dir, `no-docker-${index}`);

    await mkdir(replacement, { recursive: true });
    for (const name of await readdir(entry)) {
      if (name !== 'docker') await symlink(path.join(entry, name), path.join(replacement, name));
    }
    entries.push(replacement);
  }

  return entries.join(path.delimiter);
}

/**
 * Writes an executable stand-in for `core/bin/arcanum` that prints the
 * env it received as JSON, for the nested-guard env checks.
 * @param {string} dir - the directory to write it in.
 * @returns {Promise<string>} its path.
 */
export async function writeEnvDumpBin(dir) {
  const file = path.join(dir, 'env-dump-arcanum');

  await writeFile(file, `#!${process.execPath}\nprocess.stdout.write(JSON.stringify(process.env));\n`);
  await chmod(file, 0o755);

  return file;
}

/**
 * Builds the per-test world: a realpath'd temp dir holding a git repo
 * (`repo/`, seeded for `auto-fix-all-config-get`), a global config dir,
 * a `HOME` and an `XDG_CACHE_HOME`, plus a `dispatch` helper.
 * @returns {Promise<object>} `{ tmpDir, repoPath, configDir, env,
 *   dispatch, cleanup }`.
 */
export async function createDockerDispatchWorld() {
  const tmpDir = await realpath(await createTempDir('arcanum-core-engine-dispatch-docker-'));
  const repoPath = path.join(tmpDir, 'repo');
  const configDir = path.join(tmpDir, 'global-config');
  const cacheDir = path.join(tmpDir, 'cache');

  await mkdir(configDir);
  await mkdir(cacheDir);
  await seedRepo(repoPath);

  const env = { PATH: process.env.PATH, HOME: tmpDir, CLAUDE_CONFIG_DIR: configDir, XDG_CACHE_HOME: cacheDir };

  /**
   * Dispatches one call under a fixture status map.
   * @param {object} opts - the call.
   * @param {string} [opts.command] - the command (default `auto-fix-all-config-get`).
   * @param {string} [opts.status] - its status in the map (`null` omits the key).
   * @param {string[]} [opts.flags] - the flag/allowlist segment before `--`.
   * @param {string[]} [opts.args] - the args after `--` (default `<repo> auto_merge`).
   * @param {object} [opts.env] - the full env (default the world's).
   * @param {string} [opts.cwd] - the cwd (default the repo).
   * @param {string} [opts.repo] - the repo path (default the world's).
   * @param {string} [opts.shellScript] - the shell twin (default config_get_shell.sh).
   * @param {object} [opts.overrides] - wrapper overrides (default `{ image: IMAGE }`).
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  async function dispatch({
    command = CONFIG_GET, status = 'docker', flags = [], args, env: callEnv = env, cwd,
    repo = repoPath, shellScript = SHELL_TWIN, overrides = { image: IMAGE }
  } = {}) {
    const statusFile = await writeStatusMap(tmpDir, status === null ? {} : { [command]: status });

    return runEngineDispatch(
      statusFile,
      [repo, command, shellScript, ...flags, '--', ...(args ?? [repo, 'auto_merge'])],
      cwd ?? repo,
      callEnv,
      overrides
    );
  }

  return { tmpDir, repoPath, configDir, env, dispatch, cleanup: () => removeTempDir(tmpDir) };
}
