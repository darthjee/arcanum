import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "list-agents" migrated entrypoint (issue #234) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/234-migrate-list-agents-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs arcanum/_lib/list_agents_shell.sh (invoked
// directly, NOT through the arcanum/_lib/list_agents.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum list-agents`
// against identical fixture directories, asserting byte-identical stdout
// and exit code.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'list_agents_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a list-agents invocation (shell or native) and capture its
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
 * @param {string} repoPath - the repo path argument to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @param {string} [agentsDir] - the optional agents_dir argument.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(repoPath, cwd, agentsDir) {
  const extraArgs = agentsDir ? [agentsDir] : [];
  const shell = await runCommand([SHELL_SCRIPT, repoPath, ...extraArgs], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'list-agents', repoPath, ...extraArgs],
    cwd
  );

  return { shell, native };
}

describe('list-agents parity (shell vs. native)', () => {
  describe('an agents_dir with several real-shaped *.md files', () => {
    it('matches shell output byte-for-byte', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
        await mkdir(agentsDir, { recursive: true });
        await writeFile(
          path.join(agentsDir, 'backend.md'),
          [
            '---',
            'name: backend',
            'description: \'Backend specialist, handles the API layer\'',
            '---',
            '',
            '# backend agent body',
            ''
          ].join('\n')
        );
        await writeFile(
          path.join(agentsDir, 'frontend.md'),
          [
            '---',
            'name: frontend',
            'description: "Frontend specialist, handles the UI layer"',
            '---',
            '',
            '# frontend agent body',
            ''
          ].join('\n')
        );
        await writeFile(
          path.join(agentsDir, 'no-name.md'),
          ['---', 'description: has no name field, should be skipped', '---', '', 'body', ''].join('\n')
        );

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual(
          'backend|Backend specialist, handles the API layer\nfrontend|Frontend specialist, handles the UI layer\n'
        );
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing agents_dir', () => {
    it('matches shell output byte-for-byte (empty, exit 0)', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('an agents_dir with no *.md files', () => {
    it('matches shell output byte-for-byte (empty, exit 0)', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
        await mkdir(agentsDir, { recursive: true });
        await writeFile(path.join(agentsDir, 'not-markdown.txt'), 'name: nope\n');

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a custom agents_dir argument', () => {
    it('matches shell output byte-for-byte', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const agentsDir = path.join(repo.repoPath, 'custom-agents');
        await mkdir(agentsDir, { recursive: true });
        await writeFile(
          path.join(agentsDir, 'only.md'),
          ['---', 'name: only', 'description: the only one', '---', ''].join('\n')
        );

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath, 'custom-agents');

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('only|the only one\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-la-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth(missingPath, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a non-git repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-la-parity-');

      try {
        const { shell, native } = await runBoth(cwd, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});
