import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ID, runReplyCommentParityCase } from '../../support/factories/autoFixAllReplyCommentParitySetup.js';
import { HOSTILE_VALUE } from '../../support/fixtures/hostileTemplateValue.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

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

  describe('hostile values ($ patterns, &, \\, stray placeholders)', () => {
    let captureDir;

    beforeEach(async () => {
      captureDir = await createTempDir('arcanum-core-afarc-hostile-');
    });

    afterEach(async () => {
      await removeTempDir(captureDir);
    });

    it('posts byte-identical bodies on both sides, equal to the verbatim rendering', async () => {
      const shellCapture = path.join(captureDir, 'shell-body.md');
      const nativeCapture = path.join(captureDir, 'native-body.md');

      await runReplyCommentParityCase({
        extraEnv: {
          FAKE_GH_PR_NUMBER: '42',
          ARCANUM_TEST_FAKE_FETCH: 'success',
          FAKE_GH_COMMENT_CAPTURE_FILE: shellCapture,
          FAKE_FETCH_COMMENT_CAPTURE_FILE: nativeCapture
        },
        useFakeFetchPreload: true,
        argsTail: [ID, HOSTILE_VALUE, HOSTILE_VALUE, HOSTILE_VALUE, HOSTILE_VALUE],
        assert: ({ shell }) => {
          expect(shell.code).toEqual(0);
        }
      });

      const [shellBody, nativeBody] = await Promise.all([
        readFile(shellCapture, 'utf8'),
        readFile(nativeCapture, 'utf8')
      ]);

      expect(nativeBody).toEqual(shellBody);
      expect(shellBody).toEqual(
        `${HOSTILE_VALUE}\n\n<!-- markdownlint-disable-next-line MD036 -->\n` +
          `_Replied by: ${HOSTILE_VALUE} agent (${HOSTILE_VALUE} ${HOSTILE_VALUE})_\n`
      );
    });
  });
});
