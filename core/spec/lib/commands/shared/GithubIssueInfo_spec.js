import GithubIssue from '../../../../lib/commands/shared/GithubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { stubDeps } from '../../../support/factories/githubIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('GithubIssue#info', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  it('returns the DOMAIN=/REPO= fields resolved from origin', async () => {
    const githubIssue = new GithubIssue(undefined, stubDeps());

    const result = await githubIssue.info(repoPath);

    expect(result).toEqual('DOMAIN=github.com\nREPO=darthjee/arcanum\n');
  });

  it('round-trips a non-GitHub domain into the same DOMAIN=/REPO= shape', async () => {
    const origin = { resolve: async () => ({ domain: 'git.example.com', repo: 'acme/widgets' }) };
    const githubIssue = new GithubIssue(undefined, stubDeps({ origin }));

    const result = await githubIssue.info(repoPath);

    expect(result).toEqual('DOMAIN=git.example.com\nREPO=acme/widgets\n');
  });

  it('propagates origin.resolve\'s rejection message unchanged', async () => {
    const origin = {
      resolve: async () => {
        throw new Error(`Error: '${repoPath}' is not a git repository or has no 'origin' remote`);
      }
    };
    const githubIssue = new GithubIssue(undefined, stubDeps({ origin }));

    await expectAsync(githubIssue.info(repoPath)).toBeRejectedWithError(
      `Error: '${repoPath}' is not a git repository or has no 'origin' remote`
    );
  });

  it('resolves repoPath from the injected RepoContext when called with no argument', async () => {
    const origin = {
      resolve: jasmine.createSpy('resolve').and.resolveTo({ domain: 'github.com', repo: 'darthjee/arcanum' })
    };
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), stubDeps({ origin }));

    const result = await githubIssue.info();

    expect(origin.resolve).toHaveBeenCalledWith(repoPath);
    expect(result).toEqual('DOMAIN=github.com\nREPO=darthjee/arcanum\n');
  });
});
