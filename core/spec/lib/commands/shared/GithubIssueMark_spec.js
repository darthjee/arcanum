import GithubIssueMark, { MARK_TRANSITIONS } from '../../../../lib/commands/shared/GithubIssueMark.js';
import IssueTagger from '../../../../lib/utils/issue/IssueTagger.js';
import { fakeIssueClient } from '../../../support/factories/issueTagger.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';

const REPO = 'darthjee/arcanum';

/**
 * @param {object} [origin] - `origin` spy overrides.
 * @returns {object} a `RepoContext` mock whose `resolve()` returns a
 *   non-github.com domain, so `repo` vs `repoRef` is distinguishable.
 */
function repoContext(origin = {}) {
  return createRepoContextMock({
    origin: {
      resolve: async () => ({ domain: 'git.example.com', repo: REPO }),
      resolveWithRef: async () => ({ domain: 'git.example.com', repo: REPO, repoRef: `git.example.com/${REPO}` }),
      ...origin
    }
  });
}

/**
 * @returns {object} a fake `IssueTagger` exposing a `mutateTag` spy.
 */
function fakeTagger() {
  return { mutateTag: jasmine.createSpy('mutateTag').and.resolveTo() };
}

describe('GithubIssueMark', () => {
  describe('MARK_TRANSITIONS', () => {
    it('mirrors the cmd_mark_* add/remove table exactly', () => {
      expect(MARK_TRANSITIONS).toEqual({
        created: { add: 'created', removes: ['idea', 'writting', 'enhancing'] },
        refined: { add: 'refined', removes: ['created', 'idea', 'writting'] },
        ready: { add: 'ready', removes: ['refined'] },
        enhancing: { add: 'enhancing', removes: ['idea', 'writting'] },
        planning: { add: 'planning', removes: ['idea', 'writting', 'created'] },
        split: { add: 'split', removes: ['planning'] }
      });
    });

    it('is frozen', () => {
      expect(Object.isFrozen(MARK_TRANSITIONS)).toBeTrue();
      expect(Object.isFrozen(MARK_TRANSITIONS.created.removes)).toBeTrue();
    });
  });

  const methods = {
    markCreated: [['add', 'created'], ['remove', 'idea'], ['remove', 'writting'], ['remove', 'enhancing']],
    markRefined: [['add', 'refined'], ['remove', 'created'], ['remove', 'idea'], ['remove', 'writting']],
    markReady: [['add', 'ready'], ['remove', 'refined']],
    markEnhancing: [['add', 'enhancing'], ['remove', 'idea'], ['remove', 'writting']],
    markPlanning: [['add', 'planning'], ['remove', 'idea'], ['remove', 'writting'], ['remove', 'created']],
    markSplit: [['add', 'split'], ['remove', 'planning']]
  };

  Object.entries(methods).forEach(([method, sequence]) => {
    describe(`#${method}`, () => {
      it('calls mutateTag with the plain owner/repo in table order, and returns an empty string', async () => {
        const issueTagger = fakeTagger();
        const mark = new GithubIssueMark(repoContext(), { issueTagger });

        const result = await mark[method]('42');

        expect(result).toEqual('');
        expect(issueTagger.mutateTag.calls.allArgs()).toEqual(
          sequence.map(([action, tag]) => ['42', REPO, action, tag])
        );
      });
    });
  });

  describe('#mark', () => {
    it('propagates the resolve() rejection unchanged without mutating any tag', async () => {
      const issueTagger = fakeTagger();
      const message = 'Error: \'/nope\' is not a git repository or has no \'origin\' remote';
      const mark = new GithubIssueMark(
        repoContext({ resolve: async () => { throw new Error(message); } }),
        { issueTagger }
      );

      await expectAsync(mark.mark('created', '42')).toBeRejectedWithError(message);
      expect(issueTagger.mutateTag).not.toHaveBeenCalled();
    });

    it('builds a default IssueTagger bound to the given context', () => {
      const context = repoContext();
      const mark = new GithubIssueMark(context);

      expect(mark._issueTagger).toBeInstanceOf(IssueTagger);
      expect(mark._issueTagger._context).toBe(context);
    });

    it('resolves, attempting every tag, even when every mutation fails', async () => {
      spyOn(process.stderr, 'write');

      const context = repoContext();
      const issueClient = fakeIssueClient({ getFails: true });
      const issueTagger = new IssueTagger({ context, issueClient });
      const mark = new GithubIssueMark(context, { issueTagger });

      const { result, stdout } = await captureStdout(() => mark.markReady('42'));

      expect(result).toEqual('');
      expect(stdout).toEqual('');
      expect(issueClient.getIssue.calls.count()).toEqual(2);
      expect(process.stderr.write.calls.allArgs()).toEqual([
        [`Error: could not fetch issue #42 from ${REPO}\n`],
        [`Warning: could not add 'ready' tag to issue #42 on ${REPO}\n`],
        [`Error: could not fetch issue #42 from ${REPO}\n`],
        [`Warning: could not remove 'refined' tag from issue #42 on ${REPO}\n`]
      ]);
    });

    it('prints each per-tag stdout line through the real IssueTagger', async () => {
      const context = repoContext();
      const issueClient = fakeIssueClient({ existingLabels: ['Refined'] });
      const issueTagger = new IssueTagger({ context, issueClient });
      const mark = new GithubIssueMark(context, { issueTagger });

      const { stdout } = await captureStdout(() => mark.markReady('42'));

      expect(stdout).toEqual(
        `Added tag 'ready' to issue #42 on ${REPO}\n` +
        `Removed tag 'refined' from issue #42 on ${REPO}\n`
      );
    });
  });
});
