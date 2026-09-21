import { readFile } from 'node:fs/promises';
import IssueStateService from '../../../lib/services/IssueStateService.js';
import Lock from '../../../lib/utils/file/Lock.js';
import {
  itAcquiresAndReleasesTheLock,
  itDoesNotCorruptStateUnderConcurrentMutations,
  setUpIssueStateFixture
} from '../../support/sharedExamples/issueStateWriteSharedExamples.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

describe('IssueStateService#appendJson', () => {
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

  it('creates a one-element array when the field does not exist yet', async () => {
    const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await issueStateService.appendJson('42', 'tags', JSON.stringify('a'));

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(written).toEqual({ tags: ['a'] });
  });

  it('appends to a field that is already an array', async () => {
    const issueStateService = new IssueStateService({ context, lock: new Lock({ sleepMs: 5 }) });

    await issueStateService.setJson('42', 'tags', JSON.stringify(['a', 'b']));
    await issueStateService.appendJson('42', 'tags', JSON.stringify('c'));

    const written = JSON.parse(await readFile(stateFile, 'utf8'));

    expect(written).toEqual({ tags: ['a', 'b', 'c'] });
  });

  itAcquiresAndReleasesTheLock(
    () => ({ context, lockFile }),
    (issueStateService) => issueStateService.appendJson('42', 'tags', JSON.stringify('a'))
  );

  itDoesNotCorruptStateUnderConcurrentMutations(
    () => ({ context, stateFile }),
    (issueStateServiceA) => issueStateServiceA.appendJson('42', 'tags', JSON.stringify('a')),
    (issueStateServiceB) => issueStateServiceB.appendJson('42', 'tags', JSON.stringify('b')),
    (written) => {
      expect(Array.isArray(written.tags)).toBeTrue();
      expect(written.tags.length).toEqual(2);
      expect(written.tags).toContain('a');
      expect(written.tags).toContain('b');
    }
  );
});
