import AutoFixAllReplyComment from '../../../../lib/commands/auto-fix-all/AutoFixAllReplyComment.js';
import {
  AGENT, ID, MODEL_EMAIL, MODEL_NAME, REPLY_BODY, TEMPLATE_PATH, fakeReadFile, newContext, stubDeps
} from '../../../support/factories/autoFixAllReplyComment.js';
import { HOSTILE_VALUE } from '../../../support/fixtures/hostileTemplateValue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('AutoFixAllReplyComment (happy path)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    it('resolves the PR number, posts the rendered comment, pushes the branch, and resolves with the push stdout', async () => {
      // The template repeats %%AGENT%% so the single-pass, every-occurrence
      // substitution rule (matching reply_comment_shell.sh's perl `s///g`)
      // is actually exercised.
      const deps = stubDeps({
        readFile: fakeReadFile(
          '%%BODY%%\n\n_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_\nagain: %%AGENT%%\n'
        )
      });
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      const result = await instance.run(`#${ID}`, AGENT, MODEL_NAME, MODEL_EMAIL, REPLY_BODY);

      expect(result).toEqual('branch \'my-branch\' set up to track \'origin/my-branch\'.\n');

      expect(deps.readFile).toHaveBeenCalledWith(TEMPLATE_PATH, 'utf8');

      expect(deps.execFileAsync).toHaveBeenCalledWith(jasmine.stringMatching(/resolve_pr_number\.sh$/), [
        repoPath, ID
      ]);

      expect(deps.fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues/42/comments', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: 'Fixed in the latest commit.\n\n_Replied by: node agent (Node Agent node@example.com)_\n' +
            'again: node\n'
        }),
        signal: jasmine.any(AbortSignal)
      });

      expect(deps.execFileAsync).toHaveBeenCalledWith('git', ['-C', repoPath, 'branch', '--show-current']);
      expect(deps.execFileAsync).toHaveBeenCalledWith(
        'git', ['-C', repoPath, 'push', '-u', 'origin', 'my-branch:my-branch']
      );
    });

    it('posts hostile values verbatim in a single pass, keeping stray placeholders literal', async () => {
      const hostileAgent = 'node $& $1';
      const hostileModelName = 'Model $` & \\ $$';
      const deps = stubDeps({
        readFile: fakeReadFile('%%BODY%%\n\n_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_\n')
      });
      const instance = new AutoFixAllReplyComment(newContext(repoPath), deps);

      await instance.run(`#${ID}`, hostileAgent, hostileModelName, MODEL_EMAIL, HOSTILE_VALUE);

      const [, request] = deps.fetchFn.calls.mostRecent().args;

      expect(JSON.parse(request.body).body).toEqual(
        'a $& b $` c $\' d $$ e $1 f & g \\ h \\\\ i %%SOLUTION%% j %%BODY%%\n\n' +
          '_Replied by: node $& $1 agent (Model $` & \\ $$ node@example.com)_\n'
      );
    });
  });
});
