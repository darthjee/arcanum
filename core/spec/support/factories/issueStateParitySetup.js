import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NATIVE_BIN, REPO_ROOT, runCommand } from '../utils/runCommand.js';
import { createTempDir } from '../utils/tempDir.js';

// Shared setup for the "issue-state" parity specs (issue #238) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/238-migrate-issue-state-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Provides a git-init'd fixture-repo pair plus the
// shell and native runners: runs arcanum/_lib/issue_state_shell.sh
// (invoked directly, NOT through the arcanum/_lib/issue_state.sh
// engine_dispatch shim — so this isn't circular) and
// `core/bin/arcanum issue-state` against identical inputs applied to
// separate (but identically seeded) temp repos, so callers can assert
// byte-identical stdout, exit code, and resulting
// `.claude/state/issue-<id>.json` content.

const execFileAsync = promisify(execFile);

/** The `issue-state` shell entrypoint's script path. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'issue_state_shell.sh');

export { NATIVE_BIN, runCommand };

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
 * @param {string[]} args - the `<subcommand> <id> <field> [value]` args.
 * @param {string} shellRepo - the shell side's fixture repo path.
 * @param {string} nativeRepo - the native side's fixture repo path.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runBoth(args, shellRepo, nativeRepo) {
  const shell = await runCommand([SHELL_SCRIPT, shellRepo, ...args], shellRepo);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'issue-state', nativeRepo, ...args], nativeRepo);

  return { shell, native };
}

/**
 * @param {string} id - the issue id whose state file to compare.
 * @param {string} shellRepo - the shell side's fixture repo path.
 * @param {string} nativeRepo - the native side's fixture repo path.
 * @returns {Promise<void>} resolves once asserted equal (or both absent).
 */
export async function assertStateFilesMatch(id, shellRepo, nativeRepo) {
  const shellFile = path.join(shellRepo, '.claude', 'state', `issue-${id}.json`);
  const nativeFile = path.join(nativeRepo, '.claude', 'state', `issue-${id}.json`);

  const [shellContent, nativeContent] = await Promise.all([
    readFile(shellFile, 'utf8').catch(() => null),
    readFile(nativeFile, 'utf8').catch(() => null)
  ]);

  expect(nativeContent).toEqual(shellContent);
}
