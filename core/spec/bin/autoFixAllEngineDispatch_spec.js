import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo, seedQueue } from '../support/factories/queueParitySetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const CONFIG_SHIM = path.join(SCRIPTS_DIR, 'config.sh');
const QUEUE_SHIM = path.join(SCRIPTS_DIR, 'queue.sh');

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {string} its repo-tier config file.
 */
function repoConfigFile(repoPath) {
  return path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
}

/**
 * Seeds `auto-fix-all.auto_merge` in the repo tier.
 * @param {string} repoPath - the fixture repo.
 * @param {boolean} value - the value.
 * @returns {Promise<void>} resolves once written.
 */
async function seedAutoMerge(repoPath, value) {
  await mkdir(path.dirname(repoConfigFile(repoPath)), { recursive: true });
  await writeFile(repoConfigFile(repoPath), JSON.stringify({ 'auto-fix-all': { auto_merge: value } }));
}

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<boolean>} the repo tier's `auto-fix-all.auto_merge`.
 */
async function readAutoMerge(repoPath) {
  return JSON.parse(await readFile(repoConfigFile(repoPath), 'utf8'))['auto-fix-all'].auto_merge;
}

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<string[]>} the queue's ids.
 */
async function readQueueIds(repoPath) {
  const file = path.join(repoPath, '.claude', 'state', 'auto-fix-all-queue.json');

  return JSON.parse(await readFile(file, 'utf8')).map(({ id }) => id);
}

// Routing spec for the real auto-fix-all config.sh and queue.sh
// engine_dispatch shims (issue #745, docker batch 1): every subcommand
// under engine.mode=shell, native and docker (a passthrough fake
// `docker`). Both implementations are byte-identical, so the routing is
// proven through core/bin/arcanum's invocation log; the docker case
// also checks the `docker run` carries only the repo mount and no
// extra env. The real container is compared with native in
// core/spec/docker/ (local only).
//
// queue.sh save/push (docker batch 3, issue #747) tag the saved issues
// on GitHub, so their docker run carries the
// `--needs=global-config,gitconfig,gh` mounts and env. A fake `gh` whose
// `auth token` always fails splits the modes: the shell side's `gh
// issue view/edit` never asks for a token and tags the issue, while
// native (and the passthrough fake `docker`, which runs core/bin/arcanum
// on the host with the same `PATH`) writes the queue, then fails at
// token resolution and exits 1.
describe('auto-fix-all engine_dispatch routing (via the real shims)', () => {
  describe('config.sh', () => {
    itRoutesWithInvocationLog('get', CONFIG_SHIM, {
      command: 'auto-fix-all-config-get',
      prepare: async ({ repoPath }) => {
        await seedAutoMerge(repoPath, true);

        return { args: ['get', repoPath, 'auto_merge'] };
      },
      check: (result) => {
        expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
      },
      dockerArgs: ({ repoPath }) => [repoPath, 'auto_merge']
    });

    itRoutesWithInvocationLog('is-enabled', CONFIG_SHIM, {
      command: 'auto-fix-all-config-is-enabled',
      prepare: async ({ repoPath }) => {
        await seedAutoMerge(repoPath, true);

        return { args: ['is-enabled', repoPath, 'auto_merge'] };
      },
      check: (result) => {
        expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      },
      dockerArgs: ({ repoPath }) => [repoPath, 'auto_merge']
    });

    itRoutesWithInvocationLog('set', CONFIG_SHIM, {
      command: 'auto-fix-all-config-set',
      prepare: async ({ repoPath }) => {
        await seedAutoMerge(repoPath, false);

        return { args: ['set', repoPath, 'auto_merge', 'true'] };
      },
      check: async (result, { repoPath }) => {
        expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
        expect(await readAutoMerge(repoPath)).toEqual(true);
      },
      dockerArgs: ({ repoPath }) => [repoPath, 'auto_merge', 'true']
    });

    itRoutesWithInvocationLog('toggle', CONFIG_SHIM, {
      command: 'auto-fix-all-config-toggle',
      prepare: async ({ repoPath }) => {
        await seedAutoMerge(repoPath, true);

        return { args: ['toggle', repoPath, 'auto_merge'] };
      },
      check: async (result, { repoPath }) => {
        expect(result).toEqual({ stdout: 'false\n', stderr: '', code: 0 });
        expect(await readAutoMerge(repoPath)).toEqual(false);
      },
      dockerArgs: ({ repoPath }) => [repoPath, 'auto_merge']
    });
  });

  describe('queue.sh', () => {
    const QUEUE_CASES = [
      { sub: 'list', stdout: '7\n8\n', code: 0, ids: ['7', '8'] },
      { sub: 'next', stdout: '7\n', code: 0, ids: ['7', '8'] },
      // Seeded, so wait-next returns at once instead of polling.
      { sub: 'wait-next', stdout: '7\n', code: 0, ids: ['7', '8'] },
      { sub: 'pop', stdout: '', code: 0, ids: ['8'] },
      { sub: 'empty', stdout: '', code: 1, ids: ['7', '8'] }
    ];

    QUEUE_CASES.forEach(({ sub, stdout, code, ids }) => {
      itRoutesWithInvocationLog(sub, QUEUE_SHIM, {
        command: `auto-fix-all-queue-${sub}`,
        prepare: async ({ repoPath }) => {
          await seedQueue(repoPath, ['7', '8']);

          return { args: [sub, repoPath] };
        },
        check: async (result, { repoPath }) => {
          expect(result).toEqual({ stdout, stderr: '', code });
          expect(await readQueueIds(repoPath)).toEqual(ids);
        },
        dockerArgs: ({ repoPath }) => [repoPath]
      });
    });
  });

  describe('queue.sh (gh)', () => {
    const REPO_REF = 'darthjee/arcanum-queue-fixture';
    const GH_QUEUE_CASES = [
      { sub: 'save', line: 'Queue saved: 7\n', ids: ['7'] },
      { sub: 'push', line: 'Pushed: 7\n', ids: ['5', '7'] }
    ];

    GH_QUEUE_CASES.forEach(({ sub, line, ids }) => {
      let repoPath;

      /**
       * @returns {Promise<void>} resolves once the queue file is checked.
       */
      const expectQueue = async () => {
        expect(await readQueueIds(repoPath)).toEqual(ids);
      };
      const nativeResult = { stdout: line, stderr: '', code: 1 };

      itRoutesGhEngineDispatch(
        sub,
        QUEUE_SHIM,
        async (repo, mode) => {
          const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });

          repoPath = repo.repoPath;
          await seedGithubLikeRepo(repo);
          await seedEngineMode(repo, mode);
          await seedQueue(repo.repoPath, ['5']);

          return {
            args: [sub, repo.repoPath, '7'],
            env: { ...process.env, PATH: `${fakeGh.binDir}${path.delimiter}${process.env.PATH}` },
            cleanup: fakeGh.cleanup
          };
        },
        {
          shell: async (result) => {
            expect(result).toEqual({
              stdout: `${line}Added tag 'enqueued' to issue #7 on ${REPO_REF}\n` +
                'Tag \'ready_for_work\' not present on issue #7 — nothing to do.\n' +
                'Tag \'created\' not present on issue #7 — nothing to do.\n',
              stderr: '',
              code: 0
            });
            await expectQueue();
          },
          native: async (result) => {
            expect(result).toEqual(nativeResult);
            await expectQueue();
          },
          docker: async (result, calls, world) => {
            expect(result).toEqual(nativeResult);
            await expectQueue();
            expectGhNeedsRun(calls, repoPath, [`auto-fix-all-queue-${sub}`, repoPath, '7'], world);
          }
        }
      );
    });
  });
});
