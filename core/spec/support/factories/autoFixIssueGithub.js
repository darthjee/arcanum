import AutoFixIssueGithub from '../../../lib/commands/auto-fix-issue/AutoFixIssueGithub.js';
import RepoContext from '../../../lib/context/RepoContext.js';

export const REPO = 'darthjee/arcanum';
export const REPO_REF = REPO;
export const REPO_PATH = '/fake/repo';

/**
 * Build a fake `git` facade, answering `currentBranch`/
 * `issueFromCurrentBranch` off a fixed `branch` — mirrors the real
 * `Git`/`GitBranch` pair's `issue-<id>` regex.
 * @param {string} branch - the current branch's name.
 * @returns {object} a fake `Git`-shaped collaborator.
 */
function fakeGit(branch) {
  const match = branch.match(/^issue-(\d+)$/);
  const issue = match ? { id: match[1], branch } : null;

  return {
    currentBranch: jasmine.createSpy('currentBranch').and.resolveTo(branch),
    issueFromCurrentBranch: jasmine.createSpy('issueFromCurrentBranch').and.resolveTo(issue)
  };
}

/**
 * Build an `AutoFixIssueGithub` wired to jasmine-spy collaborators
 * (`githubClient`/`git`/`issueTagger`/`issueStateService`), so specs can
 * assert on individual calls without going through real `fetch`/`git`/
 * filesystem I/O. `branch` seeds the default `git` fake's current branch
 * (default `issue-5`, matching the `issue-<id>` state-sync path); pass
 * `branch: 'main'` for the off-`issue-<id>` no-op cases.
 * @param {object} [overrides] - per-test wiring overrides.
 * @returns {AutoFixIssueGithub} the assembled command instance.
 */
export function createAutoFixIssueGithub(overrides = {}) {
  const {
    repoPath = REPO_PATH,
    branch = 'issue-5',
    origin = {
      resolve: async () => ({ domain: 'github.com', repo: REPO }),
      resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO_REF })
    },
    githubToken = { get: async () => 'fake-token' },
    githubClient = {
      getPr: jasmine.createSpy('getPr'),
      createPr: jasmine.createSpy('createPr'),
      markPrReady: jasmine.createSpy('markPrReady')
    },
    git = fakeGit(branch),
    issueTagger = {
      mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
      fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo([]),
      addLabel: jasmine.createSpy('addLabel').and.resolveTo()
    },
    issueStateService = {
      set: jasmine.createSpy('set').and.resolveTo(),
      setJson: jasmine.createSpy('setJson').and.resolveTo()
    },
    readFile,
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath, origin, githubToken });

  return new AutoFixIssueGithub(repoContext, {
    githubClient,
    git,
    issueTagger,
    issueStateService,
    readFile,
    ...rest
  });
}
