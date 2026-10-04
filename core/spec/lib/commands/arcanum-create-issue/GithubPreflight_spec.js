import GithubPreflight from '../../../../lib/commands/arcanum-create-issue/GithubPreflight.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

describe('GithubPreflight#check', () => {
  function newPreflight({ resolve, token }) {
    const context = createRepoContextMock({
      origin: { resolve },
      githubToken: { get: token }
    });

    return new GithubPreflight(context);
  }

  it('passes for a github.com origin with a token', async () => {
    const token = jasmine.createSpy('get').and.resolveTo('secret');
    const preflight = newPreflight({
      resolve: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b' }),
      token
    });

    await expectAsync(preflight.check()).toBeResolvedTo(undefined);
    expect(token).toHaveBeenCalled();
  });

  it('passes for an ssh.github.com origin with a token', async () => {
    const token = jasmine.createSpy('get').and.resolveTo('secret');
    const preflight = newPreflight({
      resolve: jasmine.createSpy().and.resolveTo({ domain: 'ssh.github.com', repo: 'a/b' }),
      token
    });

    await expectAsync(preflight.check()).toBeResolvedTo(undefined);
    expect(token).toHaveBeenCalled();
  });

  it('fails for a non-GitHub origin without asking for a token', async () => {
    const token = jasmine.createSpy('get');
    const preflight = newPreflight({
      resolve: jasmine.createSpy().and.resolveTo({ domain: 'gitlab.com', repo: 'a/b' }),
      token
    });

    await expectAsync(preflight.check()).toBeRejectedWithError('origin is not a GitHub remote: gitlab.com/a/b');
    expect(token).not.toHaveBeenCalled();
  });

  it('strips the Error: prefix from origin failures', async () => {
    const preflight = newPreflight({
      resolve: jasmine.createSpy().and.rejectWith(new Error('Error: \'/x\' is not a git repository or has no \'origin\' remote')),
      token: jasmine.createSpy()
    });

    await expectAsync(preflight.check()).toBeRejectedWithError(
      '\'/x\' is not a git repository or has no \'origin\' remote'
    );
  });

  it('fails when no token can be obtained', async () => {
    const preflight = newPreflight({
      resolve: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: 'a/b' }),
      token: jasmine.createSpy().and.rejectWith(new Error('Error: could not obtain GitHub token via gh auth token'))
    });

    await expectAsync(preflight.check()).toBeRejectedWithError('could not obtain GitHub token via gh auth token');
  });
});
