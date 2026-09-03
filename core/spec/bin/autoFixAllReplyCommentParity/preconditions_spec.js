import path from 'node:path';
import {
  ARGS_TAIL,
  ID,
  NATIVE_BIN,
  runCommand,
  seedGithubLikeRepo,
  SHELL_SCRIPT
} from '../../support/factories/autoFixAllReplyCommentParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Full context (network isolation, fake gh/fetch, fixture-repo seeding)
// lives in
// core/spec/support/factories/autoFixAllReplyCommentParitySetup.js.

describe('auto-fix-all-reply-comment parity (shell vs. native) — preconditions', () => {
  describe('a missing required argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        // Missing reply_body (only 5 of the 6 required arguments).
        const args = [cwd, ID, 'node', 'Node Agent', 'node@example.com'];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a present-but-non-directory repo_path (hard failure)', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const args = [missingPath, ...ARGS_TAIL];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

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

  describe('a non-git repo_path (hard failure)', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        const args = [cwd, ...ARGS_TAIL];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

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

  describe('no pull request found for the current branch', () => {
    it('matches shell exit code and stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', nativeRepo.repoPath, ...ARGS_TAIL],
          nativeRepo.repoPath,
          env
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});
