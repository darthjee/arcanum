import path from 'node:path';
import { seedQueue } from '../support/factories/queueParitySetup.js';
import { itMatchesNativeInDockerWithGh } from '../support/factories/dockerGhParitySetup.js';
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
 * The real queue.sh `engine_dispatch` call for save/push (docker batch
 * 3): `--needs=global-config,gitconfig,gh`, `HOME` allowlisted, then
 * `<repo_path> <id>` — the sandbox fixture issue, which the command tags
 * `Enqueued` (removing `Ready for Work` / `Created`).
 * @param {string} sub - `save` or `push`.
 * @returns {(repoPath: string, sandbox: object) => string[]} `engine_dispatch`'s arguments.
 */
function ghQueueDispatch(sub) {
  return (repoPath, { issue }) => [
    repoPath, `auto-fix-all-queue-${sub}`, path.join(SCRIPTS_DIR, `queue_${sub}_shell.sh`),
    '--needs=global-config,gitconfig,gh', 'HOME', '--', repoPath, issue
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

  // Opt-in gh cases (docker batch 3, #747): save/push write the queue and
  // tag the sandbox fixture issue (starting from `Ready for Work` and
  // `Created` added, so both removals run), whose labels are restored
  // between and after the runs. Pending unless ARCANUM_DOCKER_PARITY_GH=1 and the
  // sandbox vars are set.
  describeParityRepos('save and push (gh)', (getWorld) => {
    itMatchesNativeInDockerWithGh('save writes the queue and tags the fixture issue', getWorld, {
      command: 'auto-fix-all-queue-save',
      needs: ['issue'],
      mutatesLabels: true,
      startLabels: ['Ready for Work', 'Created'],
      dispatchArgs: ghQueueDispatch('save'),
      check: (parity, repoPath, { issue }) => {
        expect(parity.native.stdout).toContain(`Queue saved: ${issue}\n`);
        expect(nativeWrites(parity, repoPath)).toContain(QUEUE_FILE);
      }
    });

    itMatchesNativeInDockerWithGh('push appends to the queue and tags the fixture issue', getWorld, {
      command: 'auto-fix-all-queue-push',
      needs: ['issue'],
      mutatesLabels: true,
      startLabels: ['Ready for Work', 'Created'],
      dispatchArgs: ghQueueDispatch('push'),
      seed: seedTwo,
      check: (parity, repoPath, { issue }) => {
        expect(parity.native.stdout).toContain(`Pushed: ${issue}\n`);
        expect(nativeWrites(parity, repoPath)).toContain(QUEUE_FILE);
      }
    });
  }, { worktree: true });
});
