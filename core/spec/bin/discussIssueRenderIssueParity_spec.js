import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "discuss-issue-render-issue" migrated entrypoint
// (issue #448) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/448-migrate-discuss-issue-render-issue-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs discuss-issue/scripts/render_issue_shell.sh
// (invoked directly, NOT through the discuss-issue/scripts/render_issue.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// discuss-issue-render-issue` against equivalent fixture-repo inputs,
// asserting byte-identical stdout and exit code, plus byte-identical
// written output files for the success cases.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'render_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const REAL_TEMPLATE = path.join(REPO_ROOT, 'discuss-issue', 'templates', 'issue.tmpl.md');

/**
 * Run a render-issue invocation (shell or native) and capture its
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

describe('discuss-issue-render-issue parity (shell vs. native)', () => {
  let repoPath;
  let shellOutputFile;
  let nativeOutputFile;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-dirp-parity-');
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);
    await mkdir(path.join(repoPath, 'discuss-issue', 'templates'), { recursive: true });
    const templateContent = await readFile(REAL_TEMPLATE, 'utf8');

    await writeFile(path.join(repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md'), templateContent);
    shellOutputFile = path.join(repoPath, 'shell-issue.md');
    nativeOutputFile = path.join(repoPath, 'native-issue.md');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('all sections present', () => {
    it('matches shell output byte-for-byte and writes identical files', async () => {
      const args = [
        'Something broke',
        '## Description\nDesc text',
        '## Problem\nProb text',
        '## Expected Behavior\nExp text',
        '## Solution\nSol text',
        '## Benefits\nBen text'
      ];

      const shell = await runCommand([SHELL_SCRIPT, shellOutputFile, ...args], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'discuss-issue-render-issue', repoPath, nativeOutputFile, ...args],
        repoPath
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      const [shellContent, nativeContent] = await Promise.all([
        readFile(shellOutputFile, 'utf8'),
        readFile(nativeOutputFile, 'utf8')
      ]);

      expect(nativeContent).toEqual(shellContent);
    });
  });

  describe('every section omitted (title only)', () => {
    it('matches shell output byte-for-byte and writes identical files', async () => {
      const args = ['Something broke', '', '', '', '', ''];

      const shell = await runCommand([SHELL_SCRIPT, shellOutputFile, ...args], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'discuss-issue-render-issue', repoPath, nativeOutputFile, ...args],
        repoPath
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      const [shellContent, nativeContent] = await Promise.all([
        readFile(shellOutputFile, 'utf8'),
        readFile(nativeOutputFile, 'utf8')
      ]);

      expect(nativeContent).toEqual(shellContent);
    });
  });

  describe('missing outputFile', () => {
    it('matches shell exit code with empty stdout on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'discuss-issue-render-issue', repoPath],
        repoPath
      );

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
    });
  });

  describe('missing title', () => {
    it('matches shell exit code with empty stdout on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT, shellOutputFile], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'discuss-issue-render-issue', repoPath, nativeOutputFile],
        repoPath
      );

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
    });
  });
});
