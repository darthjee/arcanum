import IssueTagger from '../../../lib/utils/issue/IssueTagger.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const REPO = 'darthjee/arcanum';

/**
 * Build a fake `IssueClient`, answering the 3 REST calls `IssueTagger`'s
 * label mutation makes per tag: `getIssue` (current labels), `addLabel`,
 * `removeLabel`.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.existingLabels] - the labels every `getIssue`
 *   call reports as already present.
 * @param {boolean} [opts.getFails] - whether `getIssue` fails.
 * @param {boolean} [opts.mutateFails] - whether every `addLabel`/
 *   `removeLabel` call fails.
 * @returns {object} a fake `IssueClient`.
 */
export function fakeIssueClient({ existingLabels = ['Ready for Work', 'Created'], getFails = false, mutateFails = false } = {}) {
  return {
    getIssue: jasmine.createSpy().and.callFake(async () => {
      if (getFails) {
        throw new Error(`Error: could not fetch issue from ${REPO}`);
      }

      return { labels: existingLabels.map((name) => ({ name })) };
    }),
    addLabel: jasmine.createSpy().and.callFake(async () => {
      if (mutateFails) {
        throw new Error(`could not add label on ${REPO}`);
      }
    }),
    removeLabel: jasmine.createSpy().and.callFake(async () => {
      if (mutateFails) {
        throw new Error(`could not remove label on ${REPO}`);
      }
    })
  };
}

/**
 * Build an `IssueTagger` wired to a fake `IssueClient` and a
 * `RepoContext` mock, for reuse across `IssueTagger` specs.
 * @param {object} [opts] - behavior overrides.
 * @param {object} [opts.issueClient] - the `IssueClient` to inject;
 *   defaults to `fakeIssueClient()`.
 * @param {object} [opts.origin] - `origin` spy overrides.
 * @param {object} [opts.githubToken] - `githubToken` spy overrides.
 * @returns {IssueTagger} an `IssueTagger` instance ready for spec use.
 */
export function newTagger({ issueClient = fakeIssueClient(), ...contextOverrides } = {}) {
  const context = createRepoContextMock({
    origin: { resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
    githubToken: { get: async () => 'fake-token' },
    ...contextOverrides
  });

  return new IssueTagger({ context, issueClient });
}
