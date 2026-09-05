import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import SpawnIssue from '../../../../lib/commands/shared/SpawnIssue.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { stubDeps, buildContext, CREATE_OUTPUT } from '../../../support/factories/spawnIssue.js';

describe('SpawnIssue#run (retry behavior)', () => {
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

  it('throws a DispatchFailure with exactly STATUS=failed\\n after maxRetryCount (default 5) attempts', async () => {
    const githubIssue = { create: jasmine.createSpy('create').and.rejectWith(new Error('boom')) };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue }), deps);

    spyOn(process.stderr, 'write');

    let thrown;

    try {
      await spawnIssue.run('1', 'New issue', bodyFile);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('STATUS=failed\n');
    expect(githubIssue.create).toHaveBeenCalledTimes(5);
    expect(deps.sleepFn).toHaveBeenCalledTimes(4);
  });

  it('honors a custom plan-issues.max-retry-count/error-sleep-time from configChain', async () => {
    const githubIssue = { create: jasmine.createSpy('create').and.rejectWith(new Error('boom')) };
    const configChain = {
      read: jasmine.createSpy('read').and.callFake(async (repo, namespace, key) => {
        if (key === 'max-retry-count') {
          return 3;
        }

        if (key === 'error-sleep-time') {
          return '2';
        }

        return undefined;
      })
    };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue, configChain }), deps);

    spyOn(process.stderr, 'write');

    let thrown;

    try {
      await spawnIssue.run('1', 'New issue', bodyFile);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(githubIssue.create).toHaveBeenCalledTimes(3);
    expect(deps.sleepFn).toHaveBeenCalledTimes(2);
    expect(deps.sleepFn).toHaveBeenCalledWith(2);
  });

  it('falls back to the default 5/5 when configChain returns a non-numeric value', async () => {
    const githubIssue = { create: jasmine.createSpy('create').and.rejectWith(new Error('boom')) };
    const configChain = { read: jasmine.createSpy('read').and.resolveTo('not-a-number') };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue, configChain }), deps);

    spyOn(process.stderr, 'write');

    let thrown;

    try {
      await spawnIssue.run('1', 'New issue', bodyFile);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(githubIssue.create).toHaveBeenCalledTimes(5);
  });

  it('resolves STATUS=ok after the second attempt, making no more attempts than necessary', async () => {
    const githubIssue = {
      create: jasmine
        .createSpy('create')
        .and.callFake(
          (() => {
            let call = 0;

            return async () => {
              call += 1;

              if (call === 1) {
                throw new Error('boom');
              }

              return CREATE_OUTPUT;
            };
          })()
        )
    };
    const deps = stubDeps();
    const spawnIssue = new SpawnIssue(buildContext(repoPath, { githubIssue }), deps);

    spyOn(process.stderr, 'write');

    const result = await spawnIssue.run('1', 'New issue', bodyFile);

    expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
    expect(githubIssue.create).toHaveBeenCalledTimes(2);
    expect(deps.sleepFn).toHaveBeenCalledTimes(1);
  });
});
