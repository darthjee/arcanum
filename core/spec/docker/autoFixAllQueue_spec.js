import path from 'node:path';
import { seedQueue } from '../support/factories/queueParitySetup.js';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const QUEUE_FILE = '.claude/state/auto-fix-all-queue.json';

/**
 * The real `auto-fix-all/scripts/queue.sh` shim's `engine_dispatch` call
 * for the read/pop subcommands (no env allowlist).
 * @param {string} sub - the subcommand.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function queueDispatch(sub) {
  return (repoPath) => [
    repoPath, `auto-fix-all-queue-${sub}`, path.join(SCRIPTS_DIR, `queue_${sub.replace('-', '_')}_shell.sh`),
    '--', repoPath
  ];
}

/**
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} seeds the queue with `7`, `8`.
 */
function seedTwo(repoPath) {
  return seedQueue(repoPath, ['7', '8']);
}

// Local-only parity cases for auto-fix-all-queue-{list,next,wait-next,pop,empty}
// (docker batch 1, #745). wait-next runs on a seeded queue, so it
// returns at once instead of polling.
describe('auto-fix-all-queue docker parity', () => {
  requireParityImage();

  describeParityRepos('list', (getWorld) => {
    itMatchesNativeInDocker('list prints every id', getWorld, {
      command: 'auto-fix-all-queue-list',
      dispatchArgs: queueDispatch('list'),
      seed: seedTwo,
      check: ({ native }) => expect(native).toEqual({ stdout: '7\n8\n', stderr: '', code: 0 })
    });
  }, { worktree: true });

  describeParityRepos('next, wait-next, pop and empty', (getWorld) => {
    itMatchesNativeInDocker('list prints (empty) without a queue', getWorld, {
      command: 'auto-fix-all-queue-list',
      dispatchArgs: queueDispatch('list'),
      check: ({ native }) => expect(native.stdout).toEqual('(empty)\n')
    });

    itMatchesNativeInDocker('next prints the head', getWorld, {
      command: 'auto-fix-all-queue-next',
      dispatchArgs: queueDispatch('next'),
      seed: seedTwo,
      check: ({ native }) => expect(native.stdout).toEqual('7\n')
    });

    itMatchesNativeInDocker('wait-next returns the head of a seeded queue at once', getWorld, {
      command: 'auto-fix-all-queue-wait-next',
      dispatchArgs: queueDispatch('wait-next'),
      seed: seedTwo,
      check: ({ native }) => expect(native.stdout).toEqual('7\n')
    });

    itMatchesNativeInDocker('pop drops the head', getWorld, {
      command: 'auto-fix-all-queue-pop',
      dispatchArgs: queueDispatch('pop'),
      seed: seedTwo,
      check: (parity, repoPath) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath)).toContain(QUEUE_FILE);
      }
    });

    itMatchesNativeInDocker('empty exits 1 for a non-empty queue', getWorld, {
      command: 'auto-fix-all-queue-empty',
      dispatchArgs: queueDispatch('empty'),
      seed: seedTwo,
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('empty exits 0 without a queue', getWorld, {
      command: 'auto-fix-all-queue-empty',
      dispatchArgs: queueDispatch('empty'),
      check: ({ native }) => expect(native.code).toEqual(0)
    });
  });
});
