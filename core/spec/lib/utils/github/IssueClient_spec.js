import IssueClient from '../../../../lib/utils/github/IssueClient.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';

describe('IssueClient', () => {
  function newClient(fetchFn) {
    const context = createRepoContextMock({
      origin: { resolveWithRef: jasmine.createSpy().and.resolveTo({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
      githubToken: { get: jasmine.createSpy().and.resolveTo(TOKEN) }
    });

    return new IssueClient({ context, fetchFn, timeoutMs: 5 });
  }

  describe('#getIssue', () => {
    it('requests the issue with the auth header', async () => {
      const issue = { number: 10, labels: [{ name: 'Ready for Work' }] };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => issue });
      const client = newClient(fetchFn);

      const result = await client.getIssue('10');

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/issues/10`,
        jasmine.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
      );
      expect(result).toEqual(issue);
    });

    it('throws a descriptive error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.getIssue('10')).toBeRejectedWithError(
        `Error: could not fetch issue #10 from ${REPO}`
      );
    });

    it('throws a descriptive error when fetch itself rejects (e.g. timeout)', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('timeout'));
      const client = newClient(fetchFn);

      await expectAsync(client.getIssue('10')).toBeRejectedWithError(
        `Error: could not fetch issue #10 from ${REPO}`
      );
    });

    it('propagates a malformed (non-JSON) response as a rejection', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({
        ok: true,
        json: async () => { throw new Error('bad json'); }
      });
      const client = newClient(fetchFn);

      await expectAsync(client.getIssue('10')).toBeRejected();
    });
  });

  describe('#addLabel', () => {
    it('POSTs the label with the auth + content-type headers', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newClient(fetchFn);

      await client.addLabel('10', 'Enqueued');

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/issues/10/labels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: ['Enqueued'] }),
        signal: jasmine.anything()
      });
    });

    it('throws a descriptive error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.addLabel('10', 'Enqueued')).toBeRejectedWithError(
        `could not add label 'Enqueued' to issue #10 on ${REPO}`
      );
    });

    it('throws a descriptive error when fetch itself rejects', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.addLabel('10', 'Enqueued')).toBeRejectedWithError(
        `could not add label 'Enqueued' to issue #10 on ${REPO}`
      );
    });
  });

  describe('#removeLabel', () => {
    it('DELETEs the (URL-encoded) label with the auth header', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newClient(fetchFn);

      await client.removeLabel('10', 'Ready for Work');

      expect(fetchFn).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO}/issues/10/labels/Ready%20for%20Work`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
          signal: jasmine.anything()
        }
      );
    });

    it('throws a descriptive error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.removeLabel('10', 'Ready for Work')).toBeRejectedWithError(
        `could not remove label 'Ready for Work' from issue #10 on ${REPO}`
      );
    });

    it('throws a descriptive error when fetch itself rejects', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.removeLabel('10', 'Ready for Work')).toBeRejectedWithError(
        `could not remove label 'Ready for Work' from issue #10 on ${REPO}`
      );
    });
  });

  describe('#createIssue', () => {
    it('POSTs the title/body with the auth + content-type headers', async () => {
      const created = { number: 42 };
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true, json: async () => created });
      const client = newClient(fetchFn);

      const result = await client.createIssue('My title', 'My body');

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My title', body: 'My body' }),
        signal: jasmine.anything()
      });
      expect(result).toEqual(created);
    });

    it('throws a descriptive error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.createIssue('My title', 'My body')).toBeRejectedWithError(
        `Error: could not create issue on ${REPO}`
      );
    });

    it('throws a descriptive error when fetch itself rejects', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.createIssue('My title', 'My body')).toBeRejectedWithError(
        `Error: could not create issue on ${REPO}`
      );
    });
  });

  describe('#postComment', () => {
    it('POSTs the comment body with the auth + content-type headers', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: true });
      const client = newClient(fetchFn);

      await client.postComment('7', 'Great work!');

      expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/repos/${REPO}/issues/7/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Great work!' }),
        signal: jasmine.anything()
      });
    });

    it('throws a descriptive error when the response is not ok', async () => {
      const fetchFn = jasmine.createSpy().and.resolveTo({ ok: false });
      const client = newClient(fetchFn);

      await expectAsync(client.postComment('7', 'Great work!')).toBeRejectedWithError(
        `Error: could not post comment on pull request #7 in ${REPO}`
      );
    });

    it('throws a descriptive error when fetch itself rejects', async () => {
      const fetchFn = jasmine.createSpy().and.rejectWith(new Error('network error'));
      const client = newClient(fetchFn);

      await expectAsync(client.postComment('7', 'Great work!')).toBeRejectedWithError(
        `Error: could not post comment on pull request #7 in ${REPO}`
      );
    });
  });
});
