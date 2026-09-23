import GithubIssue from '../../../../lib/commands/shared/GithubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { loadFixture, stubDeps } from '../../../support/factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('GithubIssue#fetchIssue', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  it('returns the TITLE/FILE/DOMAIN/REPO output for the context repo', async () => {
    const payload = await loadFixture('github_issue_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), { ...stubDeps(), fetchFn });

    const result = await githubIssue.fetchIssue('321');

    expect(result).toEqual(
      `TITLE=${payload.title}\nFILE=docs/agents/issues/321-bug-crash-on-save-caf-dition-see-12.md\n` +
        'DOMAIN=github.com\nREPO=darthjee/arcanum\n'
    );
  });

  it('delegates to #fetch with the context repoPath', async () => {
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), stubDeps());
    const fetchSpy = spyOn(githubIssue, 'fetch').and.resolveTo({
      title: 'T', file: 'docs/agents/issues/9-t.md', domain: 'github.com', repo: 'o/r'
    });

    const result = await githubIssue.fetchIssue('9');

    expect(fetchSpy).toHaveBeenCalledWith(repoPath, '9');
    expect(result).toEqual('TITLE=T\nFILE=docs/agents/issues/9-t.md\nDOMAIN=github.com\nREPO=o/r\n');
  });

  it('propagates the fetch-failure error', async () => {
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: false, status: 404 });
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), { ...stubDeps(), fetchFn });

    await expectAsync(githubIssue.fetchIssue('404')).toBeRejectedWithError(
      'Error: could not fetch issue #404 from darthjee/arcanum'
    );
  });
});
