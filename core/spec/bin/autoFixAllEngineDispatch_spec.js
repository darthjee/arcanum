import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedQueue } from '../support/factories/queueParitySetup.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
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
});
