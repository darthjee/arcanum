import {
  ARGS_TAIL,
  FAKE_FETCH_PRELOAD,
  NATIVE_BIN,
  runCommand,
  seedGithubLikeRepo,
  SHELL_SCRIPT
} from '../../support/factories/autoFixAllReplyCommentParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';

// Full context (network isolation, fake gh/fetch, fixture-repo seeding)
// lives in
// core/spec/support/factories/autoFixAllReplyCommentParitySetup.js.

describe('auto-fix-all-reply-comment parity (shell vs. native) — happy path', () => {
  describe('the happy path', () => {
    it('matches shell exit code and stdout — both relay only git push\'s own confirmation line', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          ARCANUM_TEST_FAKE_FETCH: 'success'
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-reply-comment', nativeRepo.repoPath, ...ARGS_TAIL
          ],
          nativeRepo.repoPath,
          env
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        // `git push -u`'s own stdout — neither push.sh nor
        // reply_comment_shell.sh redirects it (see
        // AutoFixAllReplyComment.js#_pushCurrentBranch's doc comment).
        expect(shell.stdout).toContain('set up to track');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});
