import GitHubTransport from '../../../../lib/utils/github/GitHubTransport.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';
const API = 'https://api.github.com';
const GRAPHQL = 'https://api.github.com/graphql';

describe('GitHubTransport', () => {
  const failure = () => new Error('domain failure');

  function newTransport(fetchFn, { resolveWithRef } = {}) {
    const context = createRepoContextMock({
      origin: {
        resolveWithRef: resolveWithRef ||
          jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: REPO, repoRef: REPO })
      },
      githubToken: { get: jasmine.createSpy().and.resolveTo(TOKEN) }
    });

    return new GitHubTransport({ context, fetchFn, timeoutMs: 5 });
  }

  describe('#repo', () => {
    it('resolves the context\'s repo identity', async () => {
      const transport = newTransport(jasmine.createSpy());

      await expectAsync(transport.repo()).toBeResolvedTo(
        jasmine.objectContaining({ repo: REPO, repoRef: REPO })
      );
    });
  });

  describe('#request', () => {
    it('GETs the API URL with only the auth header and a timeout signal', async () => {
      const response = { ok: true };
      const fetchFn = jasmine.createSpy().and.resolveTo(response);
      const transport = newTransport(fetchFn);

      const result = await transport.request(`/repos/${REPO}/pulls/7`, { failure });

      expect(fetchFn).toHaveBeenCalledWith(`${API}/repos/${REPO}/pulls/7`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: jasmine.any(AbortSignal)
      });
      expect(result).toBe(response);
    });

    it('sends the method without a body or content type when no body is given', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const transport = newTransport(fetchFn);

      await transport.request('/repos/x/git/refs/heads/b', { method: 'DELETE', failure });

      expect(fetchFn).toHaveBeenCalledWith(`${API}/repos/x/git/refs/heads/b`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: jasmine.any(AbortSignal)
      });
    });

    it('serializes the body and adds the JSON content type when a body is given', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const transport = newTransport(fetchFn);
      const body = { merge_method: 'squash' };

      await transport.request('/repos/x/pulls/7/merge', { method: 'PUT', body, failure });

      expect(fetchFn).toHaveBeenCalledWith(`${API}/repos/x/pulls/7/merge`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: jasmine.any(AbortSignal)
      });
    });

    it('throws failure() on a non-ok response', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: false }));

      await expectAsync(transport.request('/user', { failure })).toBeRejectedWithError('domain failure');
    });

    it('throws failure() when fetch rejects (e.g. timeout)', async () => {
      const transport = newTransport(jasmine.createSpy().and.rejectWith(new Error('timeout')));

      await expectAsync(transport.request('/user', { failure })).toBeRejectedWithError('domain failure');
    });
  });

  describe('#requestJson', () => {
    it('returns the parsed body', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({ a: 1 }) }));

      await expectAsync(transport.requestJson('/user', { failure })).toBeResolvedTo({ a: 1 });
    });

    it('throws failure() on malformed JSON', async () => {
      const json = async () => {
        throw new SyntaxError('Unexpected token');
      };
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json }));

      await expectAsync(transport.requestJson('/user', { failure })).toBeRejectedWithError('domain failure');
    });

    it('throws failure() on a non-ok response', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: false }));

      await expectAsync(transport.requestJson('/user', { failure })).toBeRejectedWithError('domain failure');
    });
  });

  describe('#requestArray', () => {
    it('returns an array body as-is', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json: async () => [1, 2] }));

      await expectAsync(transport.requestArray('/x', { failure })).toBeResolvedTo([1, 2]);
    });

    it('normalizes a non-array body to []', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json: async () => ({}) }));

      await expectAsync(transport.requestArray('/x', { failure })).toBeResolvedTo([]);
    });

    it('normalizes a null body to []', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json: async () => null }));

      await expectAsync(transport.requestArray('/x', { failure })).toBeResolvedTo([]);
    });
  });

  describe('#graphql', () => {
    const query = 'mutation($id: ID!) { x(input: { id: $id }) { id } }';

    it('POSTs the query and variables with auth + content-type headers', async () => {
      const payload = { data: { x: { id: 'N' } } };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => payload });
      const transport = newTransport(fetchFn);

      const result = await transport.graphql(query, { id: 'N' }, { failure });

      expect(fetchFn).toHaveBeenCalledWith(GRAPHQL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { id: 'N' } }),
        signal: jasmine.any(AbortSignal)
      });
      expect(result).toEqual(payload);
    });

    it('throws failure() on a non-ok response', async () => {
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: false }));

      await expectAsync(transport.graphql(query, {}, { failure })).toBeRejectedWithError('domain failure');
    });

    it('throws failure() when fetch rejects', async () => {
      const transport = newTransport(jasmine.createSpy().and.rejectWith(new Error('network error')));

      await expectAsync(transport.graphql(query, {}, { failure })).toBeRejectedWithError('domain failure');
    });

    it('throws failure() on malformed JSON', async () => {
      const json = async () => {
        throw new SyntaxError('Unexpected token');
      };
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json }));

      await expectAsync(transport.graphql(query, {}, { failure })).toBeRejectedWithError('domain failure');
    });

    it('throws failure() when the payload reports errors', async () => {
      const json = async () => ({ errors: [{ message: 'nope' }] });
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json }));

      await expectAsync(transport.graphql(query, {}, { failure })).toBeRejectedWithError('domain failure');
    });

    it('resolves when the errors array is empty', async () => {
      const json = async () => ({ data: {}, errors: [] });
      const transport = newTransport(jasmine.createSpy().and.resolveTo({ ok: true, json }));

      await expectAsync(transport.graphql(query, {}, { failure })).toBeResolvedTo({ data: {}, errors: [] });
    });
  });

  describe('#bestEffort', () => {
    it('swallows a rejected fetch', async () => {
      const transport = newTransport(jasmine.createSpy().and.rejectWith(new Error('network error')));

      await expectAsync(transport.bestEffort(() => transport.request('/x', { failure }))).toBeResolved();
    });

    it('swallows a context-resolution failure', async () => {
      const resolveWithRef = jasmine.createSpy().and.rejectWith(new Error('no origin'));
      const transport = newTransport(jasmine.createSpy(), { resolveWithRef });

      await expectAsync(transport.bestEffort(async () => {
        await transport.repo();
      })).toBeResolved();
    });

    it('runs the given operation', async () => {
      const fn = jasmine.createSpy().and.resolveTo();
      const transport = newTransport(jasmine.createSpy());

      await transport.bestEffort(fn);

      expect(fn).toHaveBeenCalled();
    });
  });
});
