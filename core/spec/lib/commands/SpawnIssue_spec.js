import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import SpawnIssue from '../../../lib/commands/SpawnIssue.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const REPO_REF = 'darthjee/arcanum';
const DOMAIN = 'github.com';
const CREATE_OUTPUT =
  'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n';
const USAGE = 'Usage: spawn-issue <repo_path> <parent_id> <title> <body_file> [--as-subissue]';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} the deps object passed to `new SpawnIssue(context, deps)`.
 */
function stubDeps(overrides = {}) {
  return {
    sleepFn: jasmine.createSpy('sleepFn').and.resolveTo(undefined),
    labelApplicator: { apply: jasmine.createSpy('apply').and.resolveTo(undefined) },
    issueLinker: { link: jasmine.createSpy('link').and.resolveTo(undefined) },
    repoPathValidator: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
    ...overrides
  };
}

describe('SpawnIssue', () => {
  let repoPath;
  let bodyFile;

  /**
   * Build a real `RepoContext` wrapping fake low-level collaborators —
   * mirrors `AutoFixAllWaitCi_spec.js`'s `newWaitCi` / the other
   * `context: 'repo'` command specs.
   * @param {object} [opts] - context wiring overrides.
   * @param {string} [opts.repoPath] - the context's repo path (defaults
   *   to the per-test temp dir).
   * @param {object} [opts.origin] - fake git-origin resolver.
   * @param {object} [opts.configChain] - fake 3-tier config reader.
   * @param {object} [opts.githubIssue] - fake GitHub issue creator.
   * @returns {RepoContext} the assembled context.
   */
  function buildContext({ repoPath: contextRepoPath = repoPath, origin, configChain, githubIssue } = {}) {
    return new RepoContext({
      repoPath: contextRepoPath,
      origin: origin ?? { resolve: jasmine.createSpy('resolve').and.resolveTo({ domain: DOMAIN, repo: REPO_REF }) },
      configChain: configChain ?? { read: jasmine.createSpy('read').and.resolveTo(undefined) },
      githubIssue
    });
  }

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
      it('throws a DispatchFailure with exactly STATUS=failed\\n after maxRetryCount (default 5) attempts', async () => {
        const githubIssue = { create: jasmine.createSpy('create').and.rejectWith(new Error('boom')) };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

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
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue, configChain }), deps);

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
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue, configChain }), deps);

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

                  return CREATE_OUTPUT;
                };
              })()
            )
        };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

        spyOn(process.stderr, 'write');

        const result = await spawnIssue.run('1', 'New issue', bodyFile);

        expect(result).toEqual('STATUS=ok\nID=42\nURL=https://github.com/darthjee/arcanum/issues/42\n');
        expect(githubIssue.create).toHaveBeenCalledTimes(2);
        expect(deps.sleepFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('delegation to LabelApplicator/IssueLinker', () => {
      it('applies labels and links back with the resolved repoRef, ids, title, and asSubissue flag', async () => {
        const githubIssue = { create: jasmine.createSpy('create').and.resolveTo(CREATE_OUTPUT) };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

        spyOn(process.stderr, 'write');

        await spawnIssue.run('1', 'New issue', bodyFile, '--as-subissue');

        expect(deps.labelApplicator.apply).toHaveBeenCalledWith('1', '42', REPO_REF);
        expect(deps.issueLinker.link).toHaveBeenCalledWith('1', '42', 'New issue', REPO_REF, true);
      });

      it('links back with asSubissue false when the flag is absent', async () => {
        const githubIssue = { create: jasmine.createSpy('create').and.resolveTo(CREATE_OUTPUT) };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

        spyOn(process.stderr, 'write');

        await spawnIssue.run('1', 'New issue', bodyFile);

        expect(deps.issueLinker.link).toHaveBeenCalledWith('1', '42', 'New issue', REPO_REF, false);
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
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

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

    describe('argument validation', () => {
      it('rejects when the context has no repoPath, without attempting create or repo-path validation', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ repoPath: '', githubIssue }), deps);

        await expectAsync(spawnIssue.run('1', 'New issue', bodyFile)).toBeRejectedWithError(USAGE);

        expect(githubIssue.create).not.toHaveBeenCalled();
        expect(deps.repoPathValidator.validate).not.toHaveBeenCalled();
      });

      it('rejects (before any create) when repo-path validation fails', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const repoPathValidator = {
          validate: jasmine.createSpy('validate').and.rejectWith(new Error('Error: not a directory: /bad'))
        };
        const deps = stubDeps({ repoPathValidator });
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

        await expectAsync(spawnIssue.run('1', 'New issue', bodyFile)).toBeRejectedWithError(
          'Error: not a directory: /bad'
        );

        expect(githubIssue.create).not.toHaveBeenCalled();
      });

      it('rejects a body file that does not exist, without attempting create', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);
        const missingFile = path.join(repoPath, 'does-not-exist.md');

        await expectAsync(spawnIssue.run('1', 'New issue', missingFile)).toBeRejectedWithError(
          `Error: file not found: ${missingFile}`
        );

        expect(githubIssue.create).not.toHaveBeenCalled();
      });

      it('rejects an unrecognized 5th argument', async () => {
        const githubIssue = { create: jasmine.createSpy('create') };
        const deps = stubDeps();
        const spawnIssue = new SpawnIssue(buildContext({ githubIssue }), deps);

        await expectAsync(
          spawnIssue.run('1', 'New issue', bodyFile, '--bogus-flag')
        ).toBeRejected();

        expect(githubIssue.create).not.toHaveBeenCalled();
      });
    });
  });
});
