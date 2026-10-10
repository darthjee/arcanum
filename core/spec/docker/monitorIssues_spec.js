import path from 'node:path';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'monitor-issues', 'scripts');
const CONFIG_FILE = '.claude/configuration/monitor-issues.json';
const QUEUE_FILE = '.claude/state/monitor-issues-rewrite-queue.json';

/**
 * The real monitor-issues config.sh / rewrite_queue.sh `engine_dispatch`
 * call (`--prepend-repo-path`, `$PWD` as the repo).
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's file name.
 * @param {...string} args - the shim's arguments after the subcommand.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function monitorDispatch(command, shellScript, ...args) {
  return (repoPath) => [
    repoPath, command, path.join(SCRIPTS_DIR, shellScript), '--prepend-repo-path', '--', ...args
  ];
}

/**
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} seeds `enabled=true` in the repo config.
 */
function seedEnabled(repoPath) {
  return seedRepoFile(repoPath, CONFIG_FILE, '{"enabled":true}');
}

/**
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} seeds the rewrite queue with `5`.
 */
function seedRewriteQueue(repoPath) {
  return seedRepoFile(repoPath, QUEUE_FILE, '[{"id":"5"}]');
}

// Local-only parity cases for monitor-issues-config-{get,is-enabled,set,toggle}
// and monitor-issues-rewrite-queue-{push,pop} (docker batch 1, #745).
describe('monitor-issues commands docker parity', () => {
  requireParityImage();

  describeParityRepos('rewrite-queue', (getWorld) => {
    itMatchesNativeInDocker('push appends an id', getWorld, {
      command: 'monitor-issues-rewrite-queue-push',
      dispatchArgs: monitorDispatch('monitor-issues-rewrite-queue-push', 'rewrite_queue_push_shell.sh', '9'),
      seed: seedRewriteQueue,
      check: (parity, repoPath) => {
        expect(parity.native.stdout).toEqual('Pushed: 9\n');
        expect(nativeWrites(parity, repoPath)).toContain(QUEUE_FILE);
      }
    });

    itMatchesNativeInDocker('pop prints and drops the head', getWorld, {
      command: 'monitor-issues-rewrite-queue-pop',
      dispatchArgs: monitorDispatch('monitor-issues-rewrite-queue-pop', 'rewrite_queue_pop_shell.sh'),
      seed: seedRewriteQueue,
      check: ({ native }) => expect(native.stdout).toEqual('5\n')
    });

    itMatchesNativeInDocker('pop exits 1 on an empty queue', getWorld, {
      command: 'monitor-issues-rewrite-queue-pop',
      dispatchArgs: monitorDispatch('monitor-issues-rewrite-queue-pop', 'rewrite_queue_pop_shell.sh'),
      check: ({ native }) => expect(native.code).toEqual(1)
    });
  }, { worktree: true });

  describeParityRepos('config', (getWorld) => {
    itMatchesNativeInDocker('get prints a set key', getWorld, {
      command: 'monitor-issues-config-get',
      dispatchArgs: monitorDispatch('monitor-issues-config-get', 'config_get_shell.sh', 'enabled'),
      seed: seedEnabled,
      check: ({ native }) => expect(native.stdout).toEqual('true\n')
    });

    itMatchesNativeInDocker('is-enabled exits 0 for a true key', getWorld, {
      command: 'monitor-issues-config-is-enabled',
      dispatchArgs: monitorDispatch('monitor-issues-config-is-enabled', 'config_is_enabled_shell.sh', 'enabled'),
      seed: seedEnabled,
      check: ({ native }) => expect(native.code).toEqual(0)
    });

    itMatchesNativeInDocker('set writes the repo config', getWorld, {
      command: 'monitor-issues-config-set',
      dispatchArgs: monitorDispatch('monitor-issues-config-set', 'config_set_shell.sh', 'enabled', 'false'),
      seed: seedEnabled,
      check: (parity, repoPath) => expect(nativeWrites(parity, repoPath)).toContain(CONFIG_FILE)
    });

    itMatchesNativeInDocker('set rejects a non-boolean value', getWorld, {
      command: 'monitor-issues-config-set',
      dispatchArgs: monitorDispatch('monitor-issues-config-set', 'config_set_shell.sh', 'enabled', 'maybe'),
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('toggle flips and prints the new value', getWorld, {
      command: 'monitor-issues-config-toggle',
      dispatchArgs: monitorDispatch('monitor-issues-config-toggle', 'config_toggle_shell.sh', 'enabled'),
      seed: seedEnabled,
      check: ({ native }) => expect(native.stdout).toEqual('false\n')
    });
  });
});
