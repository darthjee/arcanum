import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubIssue from '../../../../lib/commands/shared/GithubIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { loadFixture, stubDeps } from '../../../support/factories/githubIssue.js';
import { registerGithubIssueCreateSharedExamples } from '../../../support/sharedExamples/githubIssueCreateSharedExamples.js';

describe('GithubIssue#create', () => {
  const { getRepoPath, writeBodyFile } = registerGithubIssueCreateSharedExamples(
    (deps) => new GithubIssue(undefined, deps)
  );

  it('resolves repoPath from the injected RepoContext and shifts the passed positionals', async () => {
    const repoPath = getRepoPath();
    const payload = await loadFixture('github_issue_create_success.json');
    const fetchFn = jasmine.createSpy('fetch').and.resolveTo({ ok: true, json: async () => payload });
    const file = await writeBodyFile('the body');
    const deps = stubDeps();
    const githubIssue = new GithubIssue(new RepoContext({ repoPath }), { ...deps, fetchFn });

    const result = await githubIssue.create('New feature: dark mode', file);

    expect(result).toEqual(
      'ID=42\nTITLE=New feature: dark mode\nFILE=docs/agents/issues/42-new-feature-dark-mode.md\n' +
        'DOMAIN=github.com\nREPO=darthjee/arcanum\n'
    );
    expect(fetchFn).toHaveBeenCalledWith('https://api.github.com/repos/darthjee/arcanum/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'New feature: dark mode', body: 'the body' }),
      signal: jasmine.any(AbortSignal)
    });

    const written = await readFile(path.join(repoPath, 'docs/agents/issues/42-new-feature-dark-mode.md'), 'utf8');
    expect(written).toEqual('the body\n');
  });
});
