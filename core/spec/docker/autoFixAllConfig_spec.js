import path from 'node:path';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');
const REPO_CONFIG = '.claude/configuration/arcanum-repo-config.json';

/**
 * The real `auto-fix-all/scripts/config.sh` shim's `engine_dispatch` call.
 * @param {string} sub - the subcommand (`get`, `is-enabled`, `set`, `toggle`).
 * @param {...string} args - the args after `<repo_path>`.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function configDispatch(sub, ...args) {
  return (repoPath) => [
    repoPath, `auto-fix-all-config-${sub}`, path.join(SCRIPTS_DIR, `config_${sub.replace('-', '_')}_shell.sh`),
    '--', repoPath, ...args
  ];
}

/**
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} seeds `auto-fix-all.auto_merge=true`.
 */
function seedAutoMerge(repoPath) {
  return seedRepoFile(repoPath, REPO_CONFIG, JSON.stringify({ 'auto-fix-all': { auto_merge: true } }));
}

// Local-only parity cases for auto-fix-all-config-{get,is-enabled,set,toggle}
// (docker batch 1, #745): the real config.sh dispatch call runs natively
// and in PARITY_IMAGE with identical stdout, exit code and file changes.
describe('auto-fix-all-config docker parity', () => {
  requireParityImage();

  describeParityRepos('get', (getWorld) => {
    itMatchesNativeInDocker('get prints a set key', getWorld, {
      command: 'auto-fix-all-config-get',
      dispatchArgs: configDispatch('get', 'auto_merge'),
      seed: seedAutoMerge,
      check: ({ native }) => expect(native).toEqual({ stdout: 'true\n', stderr: '', code: 0 })
    });
  }, { worktree: true });

  describeParityRepos('is-enabled, set and toggle', (getWorld) => {
    itMatchesNativeInDocker('is-enabled exits 1 for an unset key', getWorld, {
      command: 'auto-fix-all-config-is-enabled',
      dispatchArgs: configDispatch('is-enabled', 'auto_merge'),
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('set writes the repo config', getWorld, {
      command: 'auto-fix-all-config-set',
      dispatchArgs: configDispatch('set', 'auto_merge', 'true'),
      check: (parity, repoPath) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath)).toEqual([REPO_CONFIG]);
      }
    });

    itMatchesNativeInDocker('set rejects a non-boolean value', getWorld, {
      command: 'auto-fix-all-config-set',
      dispatchArgs: configDispatch('set', 'auto_merge', 'maybe'),
      check: ({ native }) => expect(native.code).toEqual(1)
    });

    itMatchesNativeInDocker('toggle flips and prints the new value', getWorld, {
      command: 'auto-fix-all-config-toggle',
      dispatchArgs: configDispatch('toggle', 'auto_merge'),
      seed: seedAutoMerge,
      check: (parity, repoPath) => {
        expect(parity.native.stdout).toEqual('false\n');
        expect(nativeWrites(parity, repoPath)).toEqual([REPO_CONFIG]);
      }
    });
  });
});
