import { createAutoFixIssueGithub, REPO } from '../../../support/factories/autoFixIssueGithub.js';

const USAGE = 'Usage: github.sh pr-create <repo_path> <title> <file>';

describe('AutoFixIssueGithub#prCreate', () => {
  it('rejects when title is missing', async () => {
    const github = createAutoFixIssueGithub();

    await expectAsync(github.prCreate(undefined, 'body.md')).toBeRejectedWithError(USAGE);
  });

  it('rejects when file is missing', async () => {
    const github = createAutoFixIssueGithub();

    await expectAsync(github.prCreate('My PR')).toBeRejectedWithError(USAGE);
  });

  it('rejects with the file-not-found error text when the body file cannot be read', async () => {
    const readFile = jasmine.createSpy('readFile').and.rejectWith(new Error('ENOENT'));
    const github = createAutoFixIssueGithub({ readFile });

    await expectAsync(github.prCreate('My PR', 'missing.md')).toBeRejectedWithError(
      'Error: file not found: missing.md'
    );
  });

  it('rejects with the create-failure error text when GitHubClient#createPr fails', async () => {
    const readFile = jasmine.createSpy('readFile').and.resolveTo('body text');
    const githubClient = { createPr: jasmine.createSpy('createPr').and.rejectWith(new Error('boom')) };
    const github = createAutoFixIssueGithub({ readFile, githubClient });

    await expectAsync(github.prCreate('My PR', 'body.md')).toBeRejectedWithError(
      `Error: could not create PR on ${REPO}`
    );
  });

  describe('on success', () => {
    /**
     * @param {object} [overrides] - per-test wiring overrides.
     * @returns {object} the built collaborators/instance, for assertions.
     */
    function build(overrides = {}) {
      const readFile = jasmine.createSpy('readFile').and.resolveTo('body text');
      const githubClient = {
        createPr: jasmine.createSpy('createPr').and.resolveTo('https://github.com/darthjee/arcanum/pull/9')
      };
      const issueTagger = {
        mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
        fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo([]),
        addLabel: jasmine.createSpy('addLabel').and.resolveTo()
      };
      const issueStateService = {
        set: jasmine.createSpy('set').and.resolveTo(),
        setJson: jasmine.createSpy('setJson').and.resolveTo()
      };
      const github = createAutoFixIssueGithub({
        readFile, githubClient, issueTagger, issueStateService, ...overrides
      });

      return { github, readFile, githubClient, issueTagger, issueStateService };
    }

    it('returns the created PR url, reading the given file as the body', async () => {
      const { github, readFile, githubClient } = build();

      await expectAsync(github.prCreate('My PR', 'body.md')).toBeResolvedTo(
        'https://github.com/darthjee/arcanum/pull/9\n'
      );
      expect(readFile).toHaveBeenCalledWith('body.md', 'utf8');
      expect(githubClient.createPr).toHaveBeenCalledWith('My PR', 'body text');
    });

    it('persists pr_url/pr_id and syncs labels when on an issue-<id> branch', async () => {
      const { github, issueStateService, issueTagger } = build({ branch: 'issue-5' });

      await github.prCreate('My PR', 'body.md');

      expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_url', 'https://github.com/darthjee/arcanum/pull/9');
      expect(issueStateService.set).toHaveBeenCalledWith('5', 'pr_id', '9');
      expect(issueTagger.mutateTag).toHaveBeenCalledWith('5', REPO, 'add', 'pr');
    });

    it('is a no-op for state persistence/sync off an issue-<id> branch', async () => {
      const { github, issueStateService, issueTagger } = build({ branch: 'main' });

      await github.prCreate('My PR', 'body.md');

      expect(issueStateService.set).not.toHaveBeenCalled();
      expect(issueTagger.mutateTag).not.toHaveBeenCalled();
    });
  });
});
