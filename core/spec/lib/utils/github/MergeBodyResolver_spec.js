import MergeBodyResolver from '../../../../lib/utils/github/MergeBodyResolver.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

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
    it('returns an included empty body in "empty" mode', async () => {
      const resolver = newResolver({ configValues: { merge_body_mode: 'empty' } });

      await expectAsync(resolver.buildBody(7)).toBeResolvedTo({ included: true, body: '' });
    });

    it('returns an excluded body in "full" mode', async () => {
      const resolver = newResolver({ configValues: { merge_body_mode: 'full' } });

      await expectAsync(resolver.buildBody(7)).toBeResolvedTo({ included: false, body: '' });
    });

    describe('"coauthors" mode', () => {
      function coauthorsResolver(overrides = {}) {
        return newResolver({
          configValues: { merge_body_mode: 'coauthors' },
          ...overrides
        });
      }

      it('builds a deduped, email-sorted Co-authored-by block from the PR commits', async () => {
        const commits = [
          { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: {
            getPrCommits: jasmine.createSpy().and.resolveTo(commits),
            getCurrentUser: jasmine.createSpy().and.resolveTo({ login: 'merger' })
          }
        });

        const body = await resolver.buildBody(7);

        expect(body).toEqual({
          included: true,
          body: 'Co-authored-by: Alice <alice@x.com>\nCo-authored-by: Bob <bob@x.com>\n'
        });
      });

      it('dedupes by email, keeping one entry per address', async () => {
        const commits = [
          { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
          { commit: { author: { name: 'Bob Again', email: 'bob@x.com' } }, author: { login: 'bob' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: { getPrCommits: jasmine.createSpy().and.resolveTo(commits) }
        });

        const body = await resolver.buildBody(7);

        expect(body.body).toEqual('Co-authored-by: Bob <bob@x.com>\n');
      });

      it('excludes the entry matching the merger\'s own GitHub login', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: {
            getPrCommits: jasmine.createSpy().and.resolveTo(commits),
            getCurrentUser: jasmine.createSpy().and.resolveTo({ login: 'merger' })
          }
        });

        const body = await resolver.buildBody(7);

        expect(body.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('fails open (skips only the merger exclusion) when the merger-login lookup fails', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: {
            getPrCommits: jasmine.createSpy().and.resolveTo(commits),
            getCurrentUser: jasmine.createSpy().and.rejectWith(new Error('could not fetch current user'))
          }
        });

        const body = await resolver.buildBody(7);

        expect(body.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('excludes modelEmail\'s entry only when omit_model_coauthor is true AND modelEmail is given', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const resolver = coauthorsResolver({
          configValues: { merge_body_mode: 'coauthors', omit_model_coauthor: true },
          githubClient: { getPrCommits: jasmine.createSpy().and.resolveTo(commits) }
        });

        const body = await resolver.buildBody(7, 'model@x.com');

        expect(body.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('does not exclude modelEmail\'s entry when omit_model_coauthor is not set', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: { getPrCommits: jasmine.createSpy().and.resolveTo(commits) }
        });

        const body = await resolver.buildBody(7, 'model@x.com');

        expect(body.body).toEqual('Co-authored-by: Model <model@x.com>\n');
      });

      it('excludes any entry whose email is in the remove_coauthors config list', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } },
          { commit: { author: { name: 'Removed', email: 'removed@x.com' } }, author: { login: 'removed' } }
        ];
        const resolver = coauthorsResolver({
          configValues: { merge_body_mode: 'coauthors', remove_coauthors: ['removed@x.com'] },
          githubClient: { getPrCommits: jasmine.createSpy().and.resolveTo(commits) }
        });

        const body = await resolver.buildBody(7);

        expect(body.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('falls back to "full" mode\'s behavior (excluded) when the resulting list is empty', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } }
        ];
        const resolver = coauthorsResolver({
          githubClient: {
            getPrCommits: jasmine.createSpy().and.resolveTo(commits),
            getCurrentUser: jasmine.createSpy().and.resolveTo({ login: 'merger' })
          }
        });

        const body = await resolver.buildBody(7);

        expect(body).toEqual({ included: false, body: '' });
      });
    });
  });
});
