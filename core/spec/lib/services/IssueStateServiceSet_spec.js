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

describe('IssueStateService (field setters)', () => {
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

  describe('#set', () => {
    it('overwrites an existing field', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.set('42', 'title', 'First');
      await issueStateService.set('42', 'title', 'Second');

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ title: 'Second' });
    });

    itMergesIntoExistingState(
      () => ({ context, stateFile }),
      (issueStateService) => issueStateService.set('42', 'title', 'A Title'),
      (issueStateService) => issueStateService.set('42', 'state', 'open'),
      { title: 'A Title', state: 'open' }
    );

    itAcquiresAndReleasesTheLock(
      () => ({ context, lockFile }),
      (issueStateService) => issueStateService.set('42', 'title', 'A Title')
    );

    itDoesNotCorruptStateUnderConcurrentMutations(
      () => ({ context, stateFile }),
      (issueStateServiceA) => issueStateServiceA.set('42', 'title', 'From A'),
      (issueStateServiceB) => issueStateServiceB.set('42', 'state', 'open'),
      (written) => {
        expect(written.title === 'From A' || written.state === 'open').toBeTrue();
        expect(typeof written).toEqual('object');
      }
    );
  });

  describe('#setJson', () => {
    it('sets an object value', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.setJson('42', 'meta', JSON.stringify({ priority: 'high' }));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ meta: { priority: 'high' } });
    });

    it('sets an array value', async () => {
      const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

      await issueStateService.setJson('42', 'tags', JSON.stringify(['a', 'b']));

      const written = JSON.parse(await readFile(stateFile, 'utf8'));

      expect(written).toEqual({ tags: ['a', 'b'] });
    });

    itMergesIntoExistingState(
      () => ({ context, stateFile }),
      (issueStateService) => issueStateService.write('42', { title: 'A Title' }),
      (issueStateService) => issueStateService.setJson('42', 'tags', JSON.stringify(['a'])),
      { title: 'A Title', tags: ['a'] }
    );

    itAcquiresAndReleasesTheLock(
      () => ({ context, lockFile }),
      (issueStateService) => issueStateService.setJson('42', 'tags', JSON.stringify(['a']))
    );
  });
});
