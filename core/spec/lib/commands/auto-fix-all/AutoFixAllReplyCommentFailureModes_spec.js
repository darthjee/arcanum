import AutoFixAllReplyComment from '../../../../lib/commands/auto-fix-all/AutoFixAllReplyComment.js';
import {
  AGENT, ID, MODEL_EMAIL, MODEL_NAME, REPLY_BODY, fakeExecFileAsync, newContext, stubDeps
} from '../../../support/factories/autoFixAllReplyComment.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('AutoFixAllReplyComment (failure modes)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('when the REST call fails', () => {
      it('throws an Error and never attempts a push when the response is not ok', async () => {
        const deps = stubDeps({ fetchFn: jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 422 }) });
        const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

        await expectAsync(
          instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.execFileAsync).not.toHaveBeenCalledWith(
          'git', ['-C', repoPath, 'push', '-u', 'origin', jasmine.any(String)]
        );
      });

      it('throws an Error and never attempts a push when fetchFn rejects', async () => {
        const deps = stubDeps({ fetchFn: jasmine.createSpy('fetch').and.rejectWith(new Error('network down')) });
        const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

        await expectAsync(
          instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.execFileAsync).not.toHaveBeenCalledWith(
          'git', ['-C', repoPath, 'push', '-u', 'origin', jasmine.any(String)]
        );
      });
    });

    describe('when resolve_pr_number.sh fails', () => {
      it('throws an Error and never attempts the REST call', async () => {
        const deps = stubDeps({ execFileAsync: fakeExecFileAsync({ resolveFails: true }) });
        const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

        await expectAsync(
          instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.fetchFn).not.toHaveBeenCalled();
      });
    });

    describe('when git push fails', () => {
      it('throws an Error after the comment was already posted', async () => {
        const deps = stubDeps({ execFileAsync: fakeExecFileAsync({ pushFails: true }) });
        const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

        await expectAsync(
          instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
        ).toBeRejected();

        expect(deps.fetchFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
