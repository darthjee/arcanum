import { runReplyCommentParityCase } from '../../support/factories/autoFixAllReplyCommentParitySetup.js';

// Full context (network isolation, fake gh/fetch, fixture-repo seeding)
// lives in
// core/spec/support/factories/autoFixAllReplyCommentParitySetup.js.

describe('auto-fix-all-reply-comment parity (shell vs. native) — happy path', () => {
  describe('the happy path', () => {
    it('matches shell exit code and stdout — both relay only git push\'s own confirmation line', async () => {
      await runReplyCommentParityCase({
        extraEnv: {
          FAKE_GH_PR_NUMBER: '42',
          ARCANUM_TEST_FAKE_FETCH: 'success'
        },
        useFakeFetchPreload: true,
        assert: ({ shell }) => {
          expect(shell.code).toEqual(0);
          // `git push -u`'s own stdout — neither push.sh nor
          // reply_comment_shell.sh redirects it (see
          // AutoFixAllReplyComment.js#_pushCurrentBranch's doc comment).
          expect(shell.stdout).toContain('set up to track');
        }
      });
    });
  });
});
