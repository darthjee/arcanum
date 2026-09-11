import AutoMonitorIssuePrResolvePrNumber from '../../../../lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js';
import RepoContext from '../../../../lib/context/RepoContext.js';

const REPO_PATH = '/fake/repo';
const USAGE = 'Usage: resolve_pr_number.sh <repo_path> <id>';

/**
 * Build an `AutoMonitorIssuePrResolvePrNumber` wired to jasmine-spy
 * collaborators (`git`/`githubClient`/`issueStateService`), so specs can
 * assert on individual calls without going through real `fetch`/`git`/
 * filesystem I/O.
 * @param {object} [overrides] - per-test wiring overrides.
 * @returns {AutoMonitorIssuePrResolvePrNumber} the assembled command
 *   instance.
 */
function createCommand(overrides = {}) {
  const {
    repoPath = REPO_PATH,
    git = { currentBranch: jasmine.createSpy('currentBranch').and.resolveTo('issue-5') },
    githubClient = { getPr: jasmine.createSpy('getPr') },
    issueStateService = { get: jasmine.createSpy('get').and.resolveTo('') },
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath });

  return new AutoMonitorIssuePrResolvePrNumber(repoContext, { git, githubClient, issueStateService, ...rest });
}

describe('AutoMonitorIssuePrResolvePrNumber#run', () => {
  it('rejects with the usage error when id is missing', async () => {
    const command = createCommand();

    await expectAsync(command.run()).toBeRejectedWithError(USAGE);
  });

  it('rejects with the usage error when id is non-numeric', async () => {
    const command = createCommand();

    await expectAsync(command.run('abc')).toBeRejectedWithError(USAGE);
  });

  it('strips a leading "#" before validating/looking up id', async () => {
    const issueStateService = { get: jasmine.createSpy('get').and.resolveTo('42') };
    const command = createCommand({ issueStateService });

    await expectAsync(command.run('#5')).toBeResolvedTo('42\n');
    expect(issueStateService.get).toHaveBeenCalledWith('5', 'pr_id');
  });

  it('returns the cached pr_id without calling git.currentBranch()/githubClient.getPr()', async () => {
    const git = { currentBranch: jasmine.createSpy('currentBranch') };
    const githubClient = { getPr: jasmine.createSpy('getPr') };
    const issueStateService = { get: jasmine.createSpy('get').and.resolveTo('7') };
    const command = createCommand({ git, githubClient, issueStateService });

    await expectAsync(command.run('5')).toBeResolvedTo('7\n');
    expect(git.currentBranch).not.toHaveBeenCalled();
    expect(githubClient.getPr).not.toHaveBeenCalled();
  });

  it('falls back to the current branch\'s PR lookup on a cache miss', async () => {
    const git = { currentBranch: jasmine.createSpy('currentBranch').and.resolveTo('issue-5') };
    const githubClient = { getPr: jasmine.createSpy('getPr').and.resolveTo({ number: 42 }) };
    const issueStateService = { get: jasmine.createSpy('get').and.resolveTo('') };
    const command = createCommand({ git, githubClient, issueStateService });

    await expectAsync(command.run('5')).toBeResolvedTo('42\n');
    expect(git.currentBranch).toHaveBeenCalled();
    expect(githubClient.getPr).toHaveBeenCalledWith('issue-5');
  });

  it('propagates the not-found error from githubClient.getPr unchanged', async () => {
    const error = new Error('Error: no pull request found for the current branch on darthjee/arcanum');
    const githubClient = { getPr: jasmine.createSpy('getPr').and.rejectWith(error) };
    const command = createCommand({ githubClient });

    await expectAsync(command.run('5')).toBeRejectedWith(error);
  });
});
