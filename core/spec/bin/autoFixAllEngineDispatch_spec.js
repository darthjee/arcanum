import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  HTTPS_NOT_ALLOWED, expectGhNeedsRun, nativeCommandFailed
} from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo, seedQueue } from '../support/factories/queueParitySetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import {
  commitThenPushAssertions, itRoutesRemoteEngineDispatch
} from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { SSH_REMOTE_FAILURE } from '../support/utils/fakeSshBin.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

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

/**
 * Asserts reply_comment's native outcome when the nested
 * resolve_pr_number.sh cannot get a GitHub token.
 * @param {object} result - the shim's result.
 * @param {{repoPath: string}} ctx - the case context.
 * @returns {void}
 */
function expectReplyTokenFailure(result, { repoPath }) {
  const resolvePrNumber = path.join(REPO_ROOT, 'auto-monitor-issue-pr', 'scripts', 'resolve_pr_number.sh');

  expect(result).toEqual({
    stdout: '',
    stderr: nativeCommandFailed(
      `${resolvePrNumber} ${repoPath} 7`, 'arcanum: Error: could not obtain GitHub token via gh auth token\n'
    ),
    code: 1
  });
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

  // Docker batch 4 (issue #748): the git remote commands. Every case
  // runs in a `createRemoteNeedsWorld` with an ssh origin (all modes)
  // and an https origin (docker only), so no fetch/push ever leaves the
  // machine; the docker cases assert each shim's `--needs` wiring.
  describe('git remote commands', () => {
    /**
     * @param {string} gitError - the failed fetch's stderr.
     * @returns {string} checkout_from_main's error for a failed `main` fetch.
     */
    const fetchMainFailed = (gitError) => `Error: git fetch origin main failed: ${gitError}`;

    itRoutesRemoteEngineDispatch('checkout_from_main.sh', path.join(SCRIPTS_DIR, 'checkout_from_main.sh'), {
      command: 'auto-fix-all-checkout-from-main',
      needs: ['gitconfig', 'remote'],
      reachesRemote: true,
      prepare: async ({ repoPath }) => ({ args: [repoPath, '7'] }),
      shell: (result) => {
        expect(result).toEqual({ stdout: '', stderr: fetchMainFailed(SSH_REMOTE_FAILURE), code: 1 });
      },
      native: (result) => {
        expect(result).toEqual({ stdout: '', stderr: `arcanum: ${fetchMainFailed(SSH_REMOTE_FAILURE)}`, code: 1 });
      },
      docker: (result) => {
        expect(result).toEqual({ stdout: '', stderr: `arcanum: ${fetchMainFailed(SSH_REMOTE_FAILURE)}`, code: 1 });
      },
      https: (result) => {
        expect(result).toEqual({ stdout: '', stderr: `arcanum: ${fetchMainFailed(HTTPS_NOT_ALLOWED)}`, code: 1 });
      }
    });

    const ISSUE_FILE = 'docs/agents/issues/7-add-change.md';
    const PLAN_DIR = 'docs/agents/plans/7-add-change';

    itRoutesRemoteEngineDispatch('cleanup_artifacts.sh', path.join(SCRIPTS_DIR, 'cleanup_artifacts.sh'), {
      command: 'auto-fix-all-cleanup-artifacts',
      needs: ['global-config', 'gitconfig', 'remote'],
      reachesRemote: true,
      prepare: async ({ repoPath }, mode, world) => {
        await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
        await mkdir(path.dirname(path.join(repoPath, ISSUE_FILE)), { recursive: true });
        await writeFile(path.join(repoPath, PLAN_DIR, 'plan.md'), '# Plan\n');
        await writeFile(path.join(repoPath, ISSUE_FILE), '# Issue 7: Add change\n');
        await runCommand(['git', '-C', repoPath, 'add', 'docs'], repoPath);
        await runCommand(['git', '-C', repoPath, 'commit', '-q', '-m', 'seed artifacts'], repoPath, world.env);

        return { args: [repoPath, ISSUE_FILE, PLAN_DIR, '7', 'Spec Model', 'model@example.com'] };
      },
      ...commitThenPushAssertions('chore(docs): remove planning artifacts (issue #7)')
    });

    // The shell side resolves PR #42 and comments through the fake `gh`,
    // then fails its push; native (and the "container") fails at the
    // nested resolve_pr_number.sh's token resolution, before any remote
    // call, so only the docker wiring is asserted for the remote.
    itRoutesRemoteEngineDispatch('reply_comment.sh', path.join(SCRIPTS_DIR, 'reply_comment.sh'), {
      command: 'auto-fix-all-reply-comment',
      needs: ['global-config', 'gitconfig', 'gh', 'remote'],
      prepare: async ({ repoPath }, mode, world) => {
        const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });

        return {
          args: [repoPath, '7', 'node', 'Spec Model', 'model@example.com', 'Done.'],
          env: { PATH: `${fakeGh.binDir}${path.delimiter}${world.env.PATH}`, FAKE_GH_PR_NUMBER: '42' },
          cleanup: fakeGh.cleanup
        };
      },
      shell: (result) => {
        expect(result).toEqual({ stdout: '', stderr: SSH_REMOTE_FAILURE, code: 128 });
      },
      native: expectReplyTokenFailure,
      docker: expectReplyTokenFailure,
      https: expectReplyTokenFailure
    });
  });
});
