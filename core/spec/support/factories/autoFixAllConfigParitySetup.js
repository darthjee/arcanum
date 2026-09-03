import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../utils/runCommand.js';
import { createTempDir } from '../utils/tempDir.js';

// Shared setup for the "auto-fix-all-config-get" /
// "auto-fix-all-config-is-enabled" / "auto-fix-all-config-set" /
// "auto-fix-all-config-toggle" parity specs (issue #261) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract". Provides a fixture-repo pair plus the shell and native
// runners: runs auto-fix-all/scripts/config_<subcommand>_shell.sh
// (directly — not through config.sh's engine_dispatch shim, so this
// isn't circular) and `core/bin/arcanum auto-fix-all-config-<subcommand>`
// against identically-seeded fixture repos, so callers can assert
// byte-identical stdout and exit code for both.
//
// `repo_path_enter` (shell, via arcanum/_lib/repo_path.sh) requires
// `repo_path` to be an actual git repository, so every fixture directory
// built here is `git init`'d, matching the precedent in
// core/spec/bin/issueStateParity_spec.js.

const execFileAsync = promisify(execFile);

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/** The `auto-fix-all-config-*` shell entrypoints' script paths, by subcommand. */
export const SHELL_SCRIPTS = {
  get: path.join(SCRIPTS_DIR, 'config_get_shell.sh'),
  'is-enabled': path.join(SCRIPTS_DIR, 'config_is_enabled_shell.sh'),
  set: path.join(SCRIPTS_DIR, 'config_set_shell.sh'),
  toggle: path.join(SCRIPTS_DIR, 'config_toggle_shell.sh')
};

/** `core/bin/arcanum`'s matching command names, by subcommand. */
export const NATIVE_COMMANDS = {
  get: 'auto-fix-all-config-get',
  'is-enabled': 'auto-fix-all-config-is-enabled',
  set: 'auto-fix-all-config-set',
  toggle: 'auto-fix-all-config-toggle'
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
 * @param {'get'|'is-enabled'|'set'|'toggle'} subcommand - which
 *   subcommand to run.
 * @param {string} shellRepo - the shell side's fixture repo path.
 * @param {string} nativeRepo - the native side's fixture repo path.
 * @param {string[]} rest - the `<key> [<value>]` args, after `<repo_path>`.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runPair(subcommand, shellRepo, nativeRepo, rest) {
  const shell = await runCommand([SHELL_SCRIPTS[subcommand], shellRepo, ...rest], shellRepo);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, NATIVE_COMMANDS[subcommand], nativeRepo, ...rest],
    nativeRepo
  );

  return { shell, native };
}

/**
 * Create a fresh, git-initialized fixture repo for one side of a
 * comparison.
 * @param {string} prefix - the temp-dir prefix.
 * @returns {Promise<string>} the created repo's absolute path.
 */
export async function createFixtureRepo(prefix) {
  const dir = await createTempDir(prefix);

  await execFileAsync('git', ['init', '--quiet', '-b', 'main', dir]);

  return dir;
}

/**
 * Seed a fixture repo's `.claude/configuration/arcanum-repo-config.json`,
 * `.claude/configuration/auto-fix-all.json`, and/or
 * `.claude/state/arcanum-config.json` with the given content.
 * @param {string} repoPath - the fixture repo's path.
 * @param {object} [opts] - options.
 * @param {object} [opts.newConfig] - content for the new (namespaced)
 *   config file.
 * @param {object} [opts.legacyConfig] - content for the legacy config
 *   file.
 * @param {object} [opts.stateConfig] - content for the new state file.
 * @returns {Promise<void>} resolves once every requested file is written.
 */
export async function seedConfig(repoPath, { newConfig, legacyConfig, stateConfig } = {}) {
  if (newConfig) {
    const file = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(newConfig));
  }

  if (legacyConfig) {
    const file = path.join(repoPath, '.claude', 'configuration', 'auto-fix-all.json');

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(legacyConfig));
  }

  if (stateConfig) {
    const file = path.join(repoPath, '.claude', 'state', 'arcanum-config.json');

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(stateConfig));
  }
}
