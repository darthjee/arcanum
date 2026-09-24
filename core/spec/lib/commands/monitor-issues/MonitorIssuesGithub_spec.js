import MonitorIssuesGithub from '../../../../lib/commands/monitor-issues/MonitorIssuesGithub.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../../lib/context/RepoContextFactory.js';
import { fakeGithubFetch, REPO, TOKEN } from '../../../support/factories/autoFixAllGithub.js';

describe('MonitorIssuesGithub', () => {
  function newGithub({ repoPath = '/fake/repo', fetchFn = fakeGithubFetch() } = {}) {
    const repoContext = new RepoContext({
      repoPath,
      origin: {
        resolve: async () => ({ domain: 'github.com', repo: REPO }),
        resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO })
      },
      githubToken: { get: async () => TOKEN },
      issueStateService: { get: async () => '' },
      configChain: { read: async () => undefined }
    });

    return new MonitorIssuesGithub(repoContext, {
      repoContextFactory: new RepoContextFactory({ fetchFn, timeoutMs: 5 })
    });
  }

  describe('#removeTag', () => {
    it('rejects with the usage line when id or tag is missing', async () => {
      await expectAsync(newGithub().removeTag('5')).toBeRejectedWithError(
        'Usage: github.sh remove-tag <repo_path> <id> <tag>'
      );
      await expectAsync(newGithub({ repoPath: '' }).removeTag('5', 'created')).toBeRejectedWithError(
        'Usage: github.sh remove-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      await expectAsync(newGithub().removeTag('5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('returns a "nothing to do" line when the label is absent', async () => {
      await expectAsync(newGithub({ fetchFn: fakeGithubFetch({ labels: [] }) }).removeTag('5', 'created'))
        .toBeResolvedTo('Tag \'created\' not present on issue #5 — nothing to do.\n');
    });

    it('removes the mapped label and returns the confirmation line', async () => {
      const fetchFn = fakeGithubFetch({ labels: ['Created'] });

      await expectAsync(newGithub({ fetchFn }).removeTag('5', 'created')).toBeResolvedTo(
        `Removed tag 'created' from issue #5 on ${REPO}\n`
      );

      const deleteCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'DELETE');

      expect(deleteCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels/Created`);
    });

    it('rejects with the update-failure error when the removal fails', async () => {
      const fetchFn = fakeGithubFetch({ labels: ['Created'], mutateOk: false });

      await expectAsync(newGithub({ fetchFn }).removeTag('5', 'created')).toBeRejectedWithError(
        `Error: could not update issue #5 on ${REPO}`
      );
    });
  });

  describe('default collaborators', () => {
    it('constructs without injected dependencies', () => {
      expect(new MonitorIssuesGithub({ repoPath: '/x' })).toBeInstanceOf(MonitorIssuesGithub);
    });
  });
});
