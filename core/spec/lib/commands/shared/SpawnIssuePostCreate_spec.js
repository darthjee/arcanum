import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import SpawnIssue from '../../../../lib/commands/shared/SpawnIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { stubDeps, buildContext, REPO_REF, CREATE_OUTPUT } from '../../../support/factories/spawnIssue.js';

describe('SpawnIssue#run (post-create side effects)', () => {
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

  it('applies labels and links back with the resolved repoRef, ids, title, and asSubissue flag', async () => {
    const githubIssueService = { create: jasmine.createSpy('create').and.resolveTo(CREATE_OUTPUT) };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssueService }), deps);

    spyOn(process.stderr, 'write');

    await spawnIssue.run('1', 'New issue', bodyFile, '--as-subissue');

    expect(deps.labelApplicator.apply).toHaveBeenCalledWith('1', '42', REPO_REF);
    expect(deps.issueLinker.link).toHaveBeenCalledWith('1', '42', 'New issue', REPO_REF, true);
  });

  it('links back with asSubissue false when the flag is absent', async () => {
    const githubIssueService = { create: jasmine.createSpy('create').and.resolveTo(CREATE_OUTPUT) };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssueService }), deps);

    spyOn(process.stderr, 'write');

    await spawnIssue.run('1', 'New issue', bodyFile);

    expect(deps.issueLinker.link).toHaveBeenCalledWith('1', '42', 'New issue', REPO_REF, false);
  });

  it('warns with the loud multi-line stderr block but still resolves with STATUS=ok', async () => {
    const githubIssueService = {
      create: jasmine
        .createSpy('create')
        .and.resolveTo(
          // FILE= points at a scratch file that was never actually
          // written to disk, so the cleanup unlink() call fails.
          'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-missing-scratch.md\n' +
            'DOMAIN=github.com\nREPO=darthjee/arcanum\n'
        )
    };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssueService }), deps);

    spyOn(process.stderr, 'write');

    const result = await spawnIssue.run('1', 'New issue', bodyFile);

    expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
    expect(process.stderr.write).toHaveBeenCalledWith(
      jasmine.stringContaining('WARNING: failed to delete scratch file \'docs/agents/issues/42-missing-scratch.md\'')
    );
    expect(process.stderr.write).toHaveBeenCalledWith(
      jasmine.stringContaining('This file must NOT be committed — delete it manually right away.')
    );
  });
});
