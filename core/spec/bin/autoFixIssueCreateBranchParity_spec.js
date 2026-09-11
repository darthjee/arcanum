import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';

// Parity test for the "auto-fix-issue-create-branch" migrated entrypoint
// (issue #429) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/429-migrate-auto-fix-issue-create-branch-entrypoint-to-native-node-js/node.md's
// Notes. Runs auto-fix-issue/scripts/create_branch_shell.sh (directly,
// NOT through the auto-fix-issue/scripts/create_branch.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// auto-fix-issue-create-branch` against equivalent fixture-repo/plan-dir
// inputs, asserting byte-identical stdout (the branch name) and exit
// code on both sides.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'create_branch_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const PLAN_DIR = 'plan-dir';
const ID = '999';

/**
 * Run a create-branch invocation (shell or native) and capture its
 * stdout/stderr/exit code.
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
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<{stdout: string}>} the command's stdout.
 */
async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

/**
 * Write `<repoPath>/<PLAN_DIR>/plan.md` with a `## Branch` section
 * naming `branch`.
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @param {string} branch - the branch name to write into the plan.
 * @returns {Promise<void>} resolves once written.
 */
async function writePlanFile(repoPath, branch) {
  const planDirPath = path.join(repoPath, PLAN_DIR);

  await mkdir(planDirPath, { recursive: true });
  await writeFile(path.join(planDirPath, 'plan.md'), `# Plan\n\n## Branch\n\n\`${branch}\`\n`);
}

describe('auto-fix-issue-create-branch parity (shell vs. native)', () => {
  describe('target branch already exists locally', () => {
    it('checks it out identically on both sides and prints the same name', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([
          git(['branch', 'existing-branch'], shellRepo.repoPath),
          git(['branch', 'existing-branch'], nativeRepo.repoPath)
        ]);
        await Promise.all([
          writePlanFile(shellRepo.repoPath, 'existing-branch'),
          writePlanFile(nativeRepo.repoPath, 'existing-branch')
        ]);

        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, PLAN_DIR, ID], shellRepo.repoPath
        );
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-issue-create-branch', nativeRepo.repoPath, PLAN_DIR, ID],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('existing-branch\n');

        const [shellBranch, nativeBranch] = await Promise.all([
          git(['branch', '--show-current'], shellRepo.repoPath),
          git(['branch', '--show-current'], nativeRepo.repoPath)
        ]);

        expect(shellBranch.stdout).toEqual('existing-branch\n');
        expect(nativeBranch.stdout).toEqual(shellBranch.stdout);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('target branch does not exist yet', () => {
    it('creates it identically on both sides and prints the same name', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([
          writePlanFile(shellRepo.repoPath, 'new-branch'),
          writePlanFile(nativeRepo.repoPath, 'new-branch')
        ]);

        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, PLAN_DIR, ID], shellRepo.repoPath
        );
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-issue-create-branch', nativeRepo.repoPath, PLAN_DIR, ID],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('new-branch\n');

        const [shellBranch, nativeBranch] = await Promise.all([
          git(['branch', '--show-current'], shellRepo.repoPath),
          git(['branch', '--show-current'], nativeRepo.repoPath)
        ]);

        expect(shellBranch.stdout).toEqual('new-branch\n');
        expect(nativeBranch.stdout).toEqual(shellBranch.stdout);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('no plan.md in the given plan dir', () => {
    it('falls back to issue-<id> identically on both sides and prints the same name', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, PLAN_DIR, ID], shellRepo.repoPath
        );
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-issue-create-branch', nativeRepo.repoPath, PLAN_DIR, ID],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(`issue-${ID}\n`);

        const [shellBranch, nativeBranch] = await Promise.all([
          git(['branch', '--show-current'], shellRepo.repoPath),
          git(['branch', '--show-current'], nativeRepo.repoPath)
        ]);

        expect(shellBranch.stdout).toEqual(`issue-${ID}\n`);
        expect(nativeBranch.stdout).toEqual(shellBranch.stdout);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });
});
