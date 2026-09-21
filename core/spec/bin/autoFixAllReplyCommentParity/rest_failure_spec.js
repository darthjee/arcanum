import { runReplyCommentParityCase } from '../../support/factories/autoFixAllReplyCommentParitySetup.js';

// Full context (network isolation, fake gh/fetch, fixture-repo seeding)
// lives in
// core/spec/support/factories/autoFixAllReplyCommentParitySetup.js.

describe('auto-fix-all-reply-comment parity (shell vs. native) — REST failure', () => {
  describe('the REST call to post the comment fails', () => {
    it('matches shell exit code and stdout', async () => {
      await runReplyCommentParityCase({
        extraEnv: {
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_COMMENT_FAIL: '1',
          ARCANUM_TEST_FAKE_FETCH: 'failure'
        },
        useFakeFetchPreload: true,
        assert: ({ shell }) => {
          expect(shell.code).not.toEqual(0);
          expect(shell.stdout).toEqual('');
        }
      });
    });
  });
});
