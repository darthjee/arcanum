import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';
import SpawnIssue from '../../../lib/commands/SpawnIssue.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const REPO_REF = 'darthjee/arcanum';
const DOMAIN = 'github.com';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for SpawnIssue.
 */
function stubDeps(overrides = {}) {
  return {
    repoPath: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
    origin: { resolve: jasmine.createSpy('resolve').and.resolveTo({ domain: DOMAIN, repo: REPO_REF }) },
    repoConfig: {
      getPlanIssuesRetryConfig: jasmine
        .createSpy('getPlanIssuesRetryConfig')
        .and.resolveTo({ maxRetryCount: 3, errorSleepTime: 0 })
    },
    sleepFn: jasmine.createSpy('sleepFn').and.resolveTo(undefined),
    ...overrides
  };
}

/**
 * Build a fake `execFileAsync` implementation that answers each `gh`
 * subcommand based on its argument shape, so a single fake can serve
 * every `gh` call `SpawnIssue` makes without caring about call order.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.parentLabels] - labels returned by the parent
 *   `gh issue view --json labels` lookup.
 * @param {boolean} [opts.parentLabelsFail] - reject the labels lookup.
 * @param {boolean} [opts.editFail] - reject the `gh issue edit` call.
 * @param {boolean} [opts.parentCommentFail] - reject the parent-issue comment call.
 * @param {boolean} [opts.newCommentFail] - reject the new-issue comment call.
 * @param {boolean} [opts.graphqlFail] - reject the `addSubIssue` mutation call.
 * @param {Record<string, string>} [opts.nodeIds] - id -> GraphQL node id map.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({
  parentLabels = [],
  parentLabelsFail = false,
  editFail = false,
  parentCommentFail = false,
  newCommentFail = false,
  graphqlFail = false,
  nodeIds = {}
} = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd !== 'gh') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'issue' && args[1] === 'view' && args.includes('labels')) {
      if (parentLabelsFail) {
        throw new Error('gh: could not fetch labels');
      }

      return { stdout: `${parentLabels.join('\n')}\n` };
    }

    if (args[0] === 'issue' && args[1] === 'view' && args.includes('id')) {
      const id = args[2];

      return { stdout: `${nodeIds[id] || ''}\n` };
    }

    if (args[0] === 'issue' && args[1] === 'edit') {
      if (editFail) {
        throw new Error('gh: could not apply labels');
      }

      return { stdout: '' };
    }

    if (args[0] === 'issue' && args[1] === 'comment') {
      const isParentComment = args[3].startsWith('Spawned issue #');

      if (isParentComment && parentCommentFail) {
        throw new Error('gh: could not comment on parent');
      }

      if (!isParentComment && newCommentFail) {
        throw new Error('gh: could not comment on new issue');
      }

      return { stdout: '' };
    }

    if (args[0] === 'api' && args[1] === 'graphql') {
      if (graphqlFail) {
        throw new Error('gh: graphql mutation failed');
      }

      return { stdout: '' };
    }

    throw new Error(`unexpected gh invocation: ${JSON.stringify(args)}`);
  });
}

describe('SpawnIssue', () => {
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

  describe('#run', () => {
    describe('retry exhaustion', () => {
      it('throws a DispatchFailure with exactly STATUS=failed\\n after maxRetryCount attempts', async () => {
        const githubIssue = { create: jasmine.createSpy('create').and.rejectWith(new Error('boom')) };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync: fakeExecFileAsync() });

        spyOn(process.stderr, 'write');

        let thrown;

        try {
          await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(DispatchFailure);
        expect(thrown.stdout).toEqual('STATUS=failed\n');
        expect(githubIssue.create).toHaveBeenCalledTimes(3);
        expect(deps.sleepFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('retry then success', () => {
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

                  return 'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\n' +
                    'DOMAIN=github.com\nREPO=darthjee/arcanum\n';
                };
              })()
            )
        };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync: fakeExecFileAsync() });

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
        expect(githubIssue.create).toHaveBeenCalledTimes(2);
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('parent label lookup failure fallback', () => {
      it('applies only Spawned and does not throw', async () => {
        const githubIssue = {
          create: jasmine
            .createSpy('create')
            .and.resolveTo(
              'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
            )
        };
        const execFileAsync = fakeExecFileAsync({ parentLabelsFail: true });
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync });

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');

        const editCall = execFileAsync.calls.all().find((call) => call.args[1][1] === 'edit');

        expect(editCall.args[1]).toEqual(['issue', 'edit', '42', '-R', REPO_REF, '--add-label', 'Spawned']);
      });
    });

    describe('label filtering', () => {
      it('strips pipeline tags, keeps non-pipeline labels, and always adds Spawned once', async () => {
        const githubIssue = {
          create: jasmine
            .createSpy('create')
            .and.resolveTo(
              'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
            )
        };
        const execFileAsync = fakeExecFileAsync({ parentLabels: ['Refined', 'Ready', 'Feature', 'Bug'] });
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync });

        spyOn(process.stderr, 'write');

        await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);

        const editCall = execFileAsync.calls.all().find((call) => call.args[1][1] === 'edit');

        expect(editCall.args[1]).toEqual([
          'issue', 'edit', '42', '-R', REPO_REF,
          '--add-label', 'Feature', '--add-label', 'Bug', '--add-label', 'Spawned'
        ]);
      });
    });

    describe('--as-subissue GraphQL failure fallback', () => {
      it('warns to stderr but still resolves with STATUS=ok', async () => {
        const githubIssue = {
          create: jasmine
            .createSpy('create')
            .and.resolveTo(
              'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
            )
        };
        const execFileAsync = fakeExecFileAsync({
          graphqlFail: true,
          nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' }
        });
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync });

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run(repoPath, '1', 'New issue', bodyFile, '--as-subissue');

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n'
        );
      });
    });

    describe('--as-subissue success', () => {
      it('invokes the addSubIssue mutation with the two resolved node ids', async () => {
        const githubIssue = {
          create: jasmine
            .createSpy('create')
            .and.resolveTo(
              'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
            )
        };
        const execFileAsync = fakeExecFileAsync({
          nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' }
        });
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync });

        spyOn(process.stderr, 'write');

        await spawnIssue.run(repoPath, '1', 'New issue', bodyFile, '--as-subissue');

        const graphqlCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'api');

        expect(graphqlCall.args[1]).toEqual([
          'api', 'graphql',
          '-f', jasmine.stringMatching(/^query=/),
          '-F', 'issueId=PARENT_NODE_ID',
          '-F', 'subIssueId=NEW_NODE_ID'
        ]);
      });
    });

    describe('scratch-file cleanup failure', () => {
      it('warns with the loud multi-line stderr block but still resolves with STATUS=ok', async () => {
        const githubIssue = {
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
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync: fakeExecFileAsync() });

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
        expect(process.stderr.write).toHaveBeenCalledWith(
          jasmine.stringContaining('WARNING: failed to delete scratch file \'docs/agents/issues/42-missing-scratch.md\'')
        );
        expect(process.stderr.write).toHaveBeenCalledWith(
          jasmine.stringContaining('This file must NOT be committed — delete it manually right away.')
        );
      });
    });

    describe('linking comments best-effort', () => {
      it('warns for both failed comment calls without throwing', async () => {
        const githubIssue = {
          create: jasmine
            .createSpy('create')
            .and.resolveTo(
              'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
            )
        };
        const execFileAsync = fakeExecFileAsync({ parentCommentFail: true, newCommentFail: true });
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync });

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run(repoPath, '1', 'New issue', bodyFile);

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not comment on parent issue #1 on darthjee/arcanum\n'
        );
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not comment on issue #42 on darthjee/arcanum\n'
        );
      });
    });

    describe('argument validation', () => {
      it('rejects a body file that does not exist, without attempting create', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync: fakeExecFileAsync() });
        const missingFile = path.join(repoPath, 'does-not-exist.md');

        await expectAsync(spawnIssue.run(repoPath, '1', 'New issue', missingFile)).toBeRejectedWithError(
          `Error: file not found: ${missingFile}`
        );

        expect(githubIssue.create).not.toHaveBeenCalled();
      });

      it('rejects an unrecognized 5th argument', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue({ ...deps, githubIssue, execFileAsync: fakeExecFileAsync() });

        await expectAsync(
          spawnIssue.run(repoPath, '1', 'New issue', bodyFile, '--bogus-flag')
        ).toBeRejected();

        expect(githubIssue.create).not.toHaveBeenCalled();
      });
    });
  });
});
