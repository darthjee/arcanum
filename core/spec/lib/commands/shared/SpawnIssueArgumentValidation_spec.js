import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import SpawnIssue from '../../../../lib/commands/shared/SpawnIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { stubDeps, buildContext, USAGE } from '../../../support/factories/spawnIssue.js';

describe('SpawnIssue#run (argument validation)', () => {
  let repoPath;
  let bodyFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    bodyFile = path.join(repoPath, 'body.md');
    await writeFile(bodyFile, 'a scratch issue body\n');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  it('rejects when the context has no repoPath, without attempting create', async () => {
    const githubIssue = { create: jasmine.createSpy('create') };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext('', { githubIssue }), deps);

    await expectAsync(spawnIssue.run('1', 'New issue', bodyFile)).toBeRejectedWithError(USAGE);

    expect(githubIssue.create).not.toHaveBeenCalled();
  });

  it('rejects a body file that does not exist, without attempting create', async () => {
    const githubIssue = { create: jasmine.createSpy('create') };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue }), deps);
    const missingFile = path.join(repoPath, 'does-not-exist.md');

    await expectAsync(spawnIssue.run('1', 'New issue', missingFile)).toBeRejectedWithError(
      `Error: file not found: ${missingFile}`
    );

    expect(githubIssue.create).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized 5th argument', async () => {
    const githubIssue = { create: jasmine.createSpy('create') };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue }), deps);

    await expectAsync(
      spawnIssue.run('1', 'New issue', bodyFile, '--bogus-flag')
    ).toBeRejected();

    expect(githubIssue.create).not.toHaveBeenCalled();
  });
});
