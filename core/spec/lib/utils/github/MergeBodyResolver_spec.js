import MergeBodyResolver from '../../../../lib/utils/github/MergeBodyResolver.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { registerMergeBodyResolverSharedExamples } from '../../../support/sharedExamples/mergeBodyResolverSharedExamples.js';

describe('MergeBodyResolver', () => {
  function newResolver({ configValues = {}, githubClient = {} } = {}) {
    const context = createRepoContextMock({
      configChain: {
        read: jasmine.createSpy().and.callFake(async (repoPath, scope, key) => configValues[key])
      }
    });

    return new MergeBodyResolver({
      context,
      githubClient: {
        getPrCommits: jasmine.createSpy().and.resolveTo([]),
        getCurrentUser: jasmine.createSpy().and.resolveTo({ login: 'fake-merger' }),
        ...githubClient
      }
    });
  }

  describe('#resolveMode', () => {
    it('returns "empty" when merge_body_mode is absent', async () => {
      const resolver = newResolver();

      await expectAsync(resolver.resolveMode()).toBeResolvedTo('empty');
    });

    it('returns the configured mode when it is one of the recognized values', async () => {
      const resolver = newResolver({ configValues: { merge_body_mode: 'full' } });

      await expectAsync(resolver.resolveMode()).toBeResolvedTo('full');
    });

    it('warns to stderr and falls back to "empty" for an unrecognized value', async () => {
      spyOn(process.stderr, 'write');
      const resolver = newResolver({ configValues: { merge_body_mode: 'bogus' } });

      await expectAsync(resolver.resolveMode()).toBeResolvedTo('empty');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: unrecognized git.merge_body_mode value \'bogus\' — falling back to \'empty\'.\n'
      );
    });
  });

  describe('#buildBody', () => {
    registerMergeBodyResolverSharedExamples(async ({ commits, configValues, modelEmail }) => {
      const githubClient = { getPrCommits: jasmine.createSpy().and.resolveTo(commits) };

      if (configValues.mergerLookupFails) {
        githubClient.getCurrentUser = jasmine.createSpy().and.rejectWith(new Error('could not fetch current user'));
      }

      const resolver = newResolver({ configValues, githubClient });

      return resolver.buildBody(7, modelEmail);
    });
  });
});
