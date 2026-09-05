import AutoFixAllReplyComment from '../../../../lib/commands/auto-fix-all/AutoFixAllReplyComment.js';
import {
  AGENT, ID, MODEL_EMAIL, MODEL_NAME, REPLY_BODY, USAGE, newContext, stubDeps
} from '../../../support/factories/autoFixAllReplyComment.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('AutoFixAllReplyComment (argument validation)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    it('throws the usage message when repo_path is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(''), deps);

      await expectAsync(
        instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when id is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run('', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when id is non-numeric', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run('abc', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when id is non-numeric even with a leading #', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run('#abc', AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when agent is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run(ID, '', MODEL_NAME, MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when model_name is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run(ID, AGENT, '', MODEL_EMAIL, REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when model_email is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run(ID, AGENT, MODEL_NAME, '', REPLY_BODY)
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });

    it('throws the usage message when reply_body is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await expectAsync(
        instance.run(ID, AGENT, MODEL_NAME, MODEL_EMAIL, '')
      ).toBeRejectedWithError(USAGE);
      expect(deps.execFileAsync).not.toHaveBeenCalled();
    });
  });
});
