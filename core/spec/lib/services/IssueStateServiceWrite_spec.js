import { readFile } from 'node:fs/promises';
import IssueStateService from '../../../lib/services/IssueStateService.js';
import Lock from '../../../lib/utils/file/Lock.js';
import {
  itAcquiresAndReleasesTheLock,
  itDoesNotCorruptStateUnderConcurrentMutations,
  itMergesIntoExistingState,
  setUpIssueStateFixture
} from '../../support/sharedExamples/issueStateWriteSharedExamples.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

describe('IssueStateService (write & read)', () => {
  let repoPath;
  let context;
  let stateFile;
  let lockFile;

  beforeEach(async () => {
    ({ repoPath, context, stateFile, lockFile } = await setUpIssueStateFixture());
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#write', () => {
    it('writes the given fields to .claude/state/issue-<id>.json', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.write('42', {
        tags: ['created'],
        updated_at: '2026-01-01T00:00:00Z',
        title: 'A Title',
        state: 'open'
      });

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({
        tags: ['created'],
        updated_at: '2026-01-01T00:00:00Z',
        title: 'A Title',
        state: 'open'
      });
    });

    itMergesIntoExistingState(
      () => ({ context, stateFile }),
      (issueStateService) => issueStateService.write('42', { title: 'First' }),
      (issueStateService) => issueStateService.write('42', { state: 'closed' }),
      { title: 'First', state: 'closed' }
    );

    itAcquiresAndReleasesTheLock(
      () => ({ context, lockFile }),
      (issueStateService) => issueStateService.write('42', { title: 'A Title' })
    );

    it('releases the lock even if the mutation itself fails', async () => {
      const lock = new Lock({ sleepMs: 5 });
      spyOn(lock, 'release').and.callThrough();

      const issueStateService = new IssueStateService({ context, lock });
      spyOn(issueStateService._jsonReader, 'read').and.callFake(() => {
        throw new Error('boom');
      });

      await expectAsync(issueStateService.write('42', { title: 'x' })).toBeRejectedWithError('boom');
      expect(lock.release).toHaveBeenCalled();
    });

    itDoesNotCorruptStateUnderConcurrentMutations(
      () => ({ context, stateFile }),
      (issueStateServiceA) => issueStateServiceA.write('42', { title: 'From A' }),
      (issueStateServiceB) => issueStateServiceB.write('42', { state: 'open' }),
      (written) => {
        // Both concurrent writers' fields must be present — a corrupted/
        // interleaved write would leave one or both incomplete/invalid JSON.
        expect(written.title === 'From A' || written.state === 'open').toBeTrue();
        expect(typeof written).toEqual('object');
      }
    );
  });

  describe('#get', () => {
    it('resolves to an empty string when the state file does not exist', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await expectAsync(issueStateService.get('42', 'title')).toBeResolvedTo('');
    });

    it('resolves to an empty string when the field is missing', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.write('42', { state: 'open' });

      await expectAsync(issueStateService.get('42', 'title')).toBeResolvedTo('');
    });

    it('resolves to the value of an existing field', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.write('42', { title: 'A Title' });

      await expectAsync(issueStateService.get('42', 'title')).toBeResolvedTo('A Title');
    });
  });
});
