import { readFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../../lib/context/RepoContext.js';
import IssueStateService from '../../../lib/services/IssueStateService.js';
import Lock from '../../../lib/utils/file/Lock.js';
import { createTempDir } from '../utils/tempDir.js';

/**
 * Shared setup: builds a fresh temp repo dir, a `RepoContext` bound to
 * it, and the `.claude/state/issue-42.json`/`.lock` paths shared by
 * every `IssueStateService` write-path spec (`#set`, `#setJson`,
 * `#write`, `#appendJson`). Callers invoke this from their own
 * `beforeEach` and keep their own local `repoPath`/`context`/
 * `stateFile` variables (and their own `afterEach` calling
 * `removeTempDir(repoPath)`), so each spec file still owns its
 * `describe` block and fixture lifecycle.
 * @returns {Promise<{repoPath: string, context: RepoContext, stateFile: string, lockFile: string}>}
 *   the fixture repo path, its `RepoContext`, and the issue's state
 *   and lock file paths.
 */
export async function setUpIssueStateFixture() {
  const repoPath = await createTempDir();
  const context = new RepoContext({ repoPath });
  const stateFile = path.join(repoPath, '.claude', 'state', 'issue-42.json');
  const lockFile = path.join(repoPath, '.claude', 'state', 'issue-42.lock');

  return { repoPath, context, stateFile, lockFile };
}

/**
 * Shared example: "acquires and releases the lock file around the
 * write". Registers an `it` that spies on a fresh `Lock`'s
 * `acquire`/`release`, runs the caller's mutation against an
 * `IssueStateService` built with that lock, and asserts both were
 * called with the fixture's lock file path.
 * @param {() => {context: RepoContext, lockFile: string}} getFixture -
 *   returns the current spec's `context` and `lockFile`, read lazily
 *   since the fixture is rebuilt in each `beforeEach`.
 * @param {(issueStateService: IssueStateService) => Promise<unknown>} mutate -
 *   performs the spec-specific mutation call (e.g. `.set(...)`,
 *   `.setJson(...)`, `.write(...)`, `.appendJson(...)`).
 * @returns {void}
 */
export function itAcquiresAndReleasesTheLock(getFixture, mutate) {
  it('acquires and releases the lock file around the write', async () => {
    const { context, lockFile } = getFixture();
    const lock = new Lock({ sleepMs: 5 });
    spyOn(lock, 'acquire').and.callThrough();
    spyOn(lock, 'release').and.callThrough();

    const issueStateService = new IssueStateService({ context, lock });

    await mutate(issueStateService);

    expect(lock.acquire).toHaveBeenCalledWith(lockFile);
    expect(lock.release).toHaveBeenCalledWith(lockFile);
  });
}

/**
 * Shared example: "does not corrupt state under two near-simultaneous
 * mutations to the same issue". Registers an `it` that runs two
 * `IssueStateService` instances' mutations concurrently against the
 * same issue and hands the resulting parsed state file to the
 * caller's assertion.
 * @param {() => {context: RepoContext, stateFile: string}} getFixture -
 *   returns the current spec's `context` and `stateFile`.
 * @param {(issueStateServiceA: IssueStateService) => Promise<unknown>} mutateA -
 *   the first concurrent mutation call.
 * @param {(issueStateServiceB: IssueStateService) => Promise<unknown>} mutateB -
 *   the second concurrent mutation call.
 * @param {(written: object) => void} assertMerged - asserts on the
 *   parsed state file once both concurrent mutations have settled.
 * @returns {void}
 */
export function itDoesNotCorruptStateUnderConcurrentMutations(getFixture, mutateA, mutateB, assertMerged) {
  it('does not corrupt state under two near-simultaneous mutations to the same issue', async () => {
    const { context, stateFile } = getFixture();
    const issueStateServiceA = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });
    const issueStateServiceB = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await Promise.all([
      mutateA(issueStateServiceA),
      mutateB(issueStateServiceB)
    ]);

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    assertMerged(written);
  });
}

/**
 * Shared example: "merges into (rather than replaces) any
 * pre-existing state". Registers an `it` that runs two sequential
 * mutations against a single `IssueStateService` and asserts the
 * resulting state file equals the caller's expected merged object.
 * @param {() => {context: RepoContext, stateFile: string}} getFixture -
 *   returns the current spec's `context` and `stateFile`.
 * @param {(issueStateService: IssueStateService) => Promise<unknown>} mutateFirst -
 *   the first mutation call.
 * @param {(issueStateService: IssueStateService) => Promise<unknown>} mutateSecond -
 *   the second mutation call, expected to merge with the first.
 * @param {object} expectedMerged - the expected fully-merged state.
 * @returns {void}
 */
export function itMergesIntoExistingState(getFixture, mutateFirst, mutateSecond, expectedMerged) {
  it('merges into (rather than replaces) any pre-existing state', async () => {
    const { context, stateFile } = getFixture();
    const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await mutateFirst(issueStateService);
    await mutateSecond(issueStateService);

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(written).toEqual(expectedMerged);
  });
}
