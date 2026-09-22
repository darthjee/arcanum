import { createAutoFixIssueGithub, REPO } from '../factories/autoFixIssueGithub.js';

/**
 * Build the common `{ branch, issueTagger, issueStateService, ... }`
 * overrides shape the GitHub state-sync trio (`_persistPrState`/
 * `_syncPrLabelsAndState`, `#prReady`, `#prView`) wires into
 * `createAutoFixIssueGithub(...)`. Defaults to an `issue-5` branch with
 * jasmine-spy `issueTagger`/`issueStateService` collaborators matching
 * the factory's own defaults (`mutateTag`/`fetchLabels`/`addLabel`,
 * `set`/`setJson`, all resolving); pass individual overrides (e.g. a
 * specific `fetchLabels` resolution, `branch: 'main'` for the no-op
 * case, or an `issueStateService.set` that rejects) to vary just what a
 * given test needs — `issueTagger`/`issueStateService` overrides are
 * shallow-merged over the defaults, so a caller only has to redeclare
 * the one spy it wants to change.
 * @param {object} [overrides] - per-test overrides merged over the
 *   defaults; any extra keys (e.g. `githubClient`) pass through
 *   untouched.
 * @returns {object} the `createAutoFixIssueGithub(...)`-ready overrides.
 */
export function githubStateFixture(overrides = {}) {
  const { branch = 'issue-5', issueTagger = {}, issueStateService = {}, ...rest } = overrides;

  return {
    branch,
    issueTagger: {
      mutateTag: jasmine.createSpy('mutateTag').and.resolveTo(),
      fetchLabels: jasmine.createSpy('fetchLabels').and.resolveTo([]),
      addLabel: jasmine.createSpy('addLabel').and.resolveTo(),
      ...issueTagger
    },
    issueStateService: {
      set: jasmine.createSpy('set').and.resolveTo(),
      setJson: jasmine.createSpy('setJson').and.resolveTo(),
      ...issueStateService
    },
    ...rest
  };
}

/**
 * Shared example: the "persists PR state and syncs GitHub labels/tags
 * when on an issue-<id> branch" scenario, and its "is a no-op off an
 * issue-<id> branch" counterpart, shared by every entrypoint that
 * triggers `AutoFixIssueGithub`'s state-sync path (`_persistPrState` +
 * `_syncPrLabelsAndState`, `#prReady`, `#prView`). Registers flat `it`s
 * (no `describe` wrapper of its own — callers invoke this from whichever
 * `describe` block they want the scenarios grouped under). Each call
 * site builds its own fixture (e.g. a `githubClient.getPr` stub
 * resolving the PR under test) via `buildFixture`, and states which of
 * the shared assertions actually apply via `expectations`.
 * @param {(github: import('../../../lib/commands/auto-fix-issue/AutoFixIssueGithub.js').default) => Promise<any>} exercise -
 *   performs the action under test (e.g. `(github) => github.prReady()`)
 *   against the fixture's `AutoFixIssueGithub` instance.
 * @param {object} [expectations] - what to assert once `exercise` runs.
 * @param {string} [expectations.prUrl] - when given, asserts
 *   `issueStateService.set('5', 'pr_url', prUrl)`.
 * @param {string} [expectations.prId] - when given, asserts
 *   `issueStateService.set('5', 'pr_id', prId)`.
 * @param {boolean} [expectations.tag] - whether to also assert/refute
 *   `issueTagger.mutateTag('5', REPO, 'add', 'pr')` (default `true`).
 * @param {() => object} [expectations.buildFixture] - builds the extra
 *   overrides (e.g. `githubClient`) merged into `githubStateFixture(...)`
 *   for each `it`; invoked fresh per test so jasmine spies don't leak
 *   call history across the on-branch/off-branch scenarios.
 * @returns {void}
 */
export function registerSyncsGithubStateSharedExamples(exercise, expectations = {}) {
  const { prUrl, prId, tag = true, buildFixture = () => ({}) } = expectations;

  it('persists pr state and syncs labels/tags when on an issue-<id> branch', async () => {
    const fixture = githubStateFixture({ branch: 'issue-5', ...buildFixture() });
    const github = createAutoFixIssueGithub(fixture);

    await exercise(github);

    if (prUrl !== undefined) {
      expect(fixture.issueStateService.set).toHaveBeenCalledWith('5', 'pr_url', prUrl);
    }
    if (prId !== undefined) {
      expect(fixture.issueStateService.set).toHaveBeenCalledWith('5', 'pr_id', prId);
    }
    if (tag) {
      expect(fixture.issueTagger.mutateTag).toHaveBeenCalledWith('5', REPO, 'add', 'pr');
    }
  });

  it('is a no-op for state persistence/sync off an issue-<id> branch', async () => {
    const fixture = githubStateFixture({ branch: 'main', ...buildFixture() });
    const github = createAutoFixIssueGithub(fixture);

    await exercise(github);

    expect(fixture.issueStateService.set).not.toHaveBeenCalled();
    if (tag) {
      expect(fixture.issueTagger.mutateTag).not.toHaveBeenCalled();
    }
  });
}
