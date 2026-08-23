import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-config-get" /
// "auto-fix-all-config-is-enabled" / "auto-fix-all-config-set" /
// "auto-fix-all-config-toggle" migrated entrypoints (issue #261) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/261-migrate-auto-fix-all-config-entrypoint-get-is-enabled-set-toggle-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/config_<subcommand>_shell.sh
// (directly — not through config.sh's engine_dispatch shim, so this isn't
// circular) and `core/bin/arcanum auto-fix-all-config-<subcommand>` against
// identically-seeded fixture repos, asserting byte-identical stdout and
// exit code for both.
//
// Both `repo_path_enter` (shell, via arcanum/_lib/repo_path.sh) requires
// `repo_path` to be an actual git repository, so every fixture directory
// below is `git init`'d, matching the precedent in
// core/spec/bin/issueStateParity_spec.js.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const SHELL_SCRIPTS = {
  get: path.join(SCRIPTS_DIR, 'config_get_shell.sh'),
  'is-enabled': path.join(SCRIPTS_DIR, 'config_is_enabled_shell.sh'),
  set: path.join(SCRIPTS_DIR, 'config_set_shell.sh'),
  toggle: path.join(SCRIPTS_DIR, 'config_toggle_shell.sh')
};

const NATIVE_COMMANDS = {
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
async function runCommand([file, ...args], cwd) {
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
async function runPair(subcommand, shellRepo, nativeRepo, rest) {
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
async function createFixtureRepo(prefix) {
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
async function seedConfig(repoPath, { newConfig, legacyConfig, stateConfig } = {}) {
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

describe('auto-fix-all-config-* parity (shell vs. native)', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createFixtureRepo('arcanum-core-afac-parity-shell-');
    nativeRepo = await createFixtureRepo('arcanum-core-afac-parity-native-');
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  describe('get', () => {
    it('matches shell output for a key present in the new file', async () => {
      const seeded = { 'auto-fix-all': { auto_merge: true } };

      await seedConfig(shellRepo, { newConfig: seeded });
      await seedConfig(nativeRepo, { newConfig: seeded });

      const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('true\n');
    });

    it('matches shell output for a key present only in the legacy file', async () => {
      const seeded = { auto_merge: false };

      await seedConfig(shellRepo, { legacyConfig: seeded });
      await seedConfig(nativeRepo, { legacyConfig: seeded });

      const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('false\n');
    });

    it('matches shell output (default "false") for a key absent everywhere', async () => {
      const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('false\n');
    });

    it('matches shell output for a clear_context-style key, ignoring the legacy file', async () => {
      const seeded = { clear_context: true };

      await seedConfig(shellRepo, { legacyConfig: seeded });
      await seedConfig(nativeRepo, { legacyConfig: seeded });

      const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['clear_context']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('false\n');
    });
  });

  describe('is-enabled', () => {
    it('matches shell output (exit 0, empty stdout) when the resolved value is "true"', async () => {
      const seeded = { 'auto-fix-all': { auto_merge: true } };

      await seedConfig(shellRepo, { newConfig: seeded });
      await seedConfig(nativeRepo, { newConfig: seeded });

      const { shell, native } = await runPair('is-enabled', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });

    it('matches shell output (exit 1, empty stdout) when the resolved value is "false"/absent', async () => {
      const { shell, native } = await runPair('is-enabled', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('set', () => {
    it('matches shell output (exit 0, empty stdout) for a valid write, and the persisted value matches on both sides', async () => {
      const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge', 'true']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      const getResult = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

      expect(getResult.shell.stdout).toEqual('true\n');
      expect(getResult.native.stdout).toEqual(getResult.shell.stdout);
    });

    it('matches shell exit code (1) and empty stdout for missing args', async () => {
      const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });

    it('matches shell exit code (1) and empty stdout for an invalid value', async () => {
      const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge', 'yes']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('toggle', () => {
    it('matches shell output flipping "true" to "false\\n"', async () => {
      const seeded = { 'auto-fix-all': { auto_merge: true } };

      await seedConfig(shellRepo, { newConfig: seeded });
      await seedConfig(nativeRepo, { newConfig: seeded });

      const { shell, native } = await runPair('toggle', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('false\n');
    });

    it('matches shell output flipping an absent/"false" value to "true\\n"', async () => {
      const { shell, native } = await runPair('toggle', shellRepo, nativeRepo, ['auto_merge']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('true\n');
    });
  });
});
