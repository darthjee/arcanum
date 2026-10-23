import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../../../shared/lib/file/Lock.js';
import { runCli } from './cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from './fixtures.js';

const MIGRATIONS = { repo: [], local: [], global: [] };

/**
 * A fake account and repo for the shortcut specs, whose tiers can be
 * re-seeded between runs, so a shortcut and its generic equivalent run
 * against the same files and their outputs can be compared byte for byte.
 * @returns {object} the harness: `setup`/`teardown` (for `beforeEach`/
 *   `afterEach`), `seed`, `run`, `both` and the fixture paths.
 */
export function shortcutHarness() {
  const harness = {
    async setup() {
      harness.tmp = await tmpDir();
      harness.account = path.join(harness.tmp, 'account');
      harness.globalFile = path.join(harness.account, 'arcanum-config.json');
      await mkdir(harness.account);
      harness.root = await makeRepo(path.join(harness.tmp, 'repo'), { repoConfig: { version: '2.4.0' } });
      harness.repoFile = path.join(harness.root, REPO_FILE);
      harness.localFile = path.join(harness.root, LOCAL_FILE);
      harness.env = { CLAUDE_CONFIG_DIR: harness.account };
      harness.deps = { lock: new Lock({ sleepMs: 10 }), signals: { on: () => {}, off: () => {}, exit: () => {} } };
    },

    async teardown() {
      await removeDir(harness.tmp);
    },

    /**
     * Rewrites the three tier files: the repo file always (with its
     * version pointer), the local and global ones only when given.
     * @param {object} [tiers] - each tier's content.
     * @param {object} [tiers.local] - the local tier (absent: no file).
     * @param {object} [tiers.repo] - extra repo tier keys.
     * @param {object} [tiers.global] - the global tier (absent: no file).
     * @returns {Promise<void>} resolves once written.
     */
    async seed({ local, repo = {}, global } = {}) {
      await writeTier(harness.repoFile, { version: '2.4.0', ...repo });

      for (const [file, content] of [[harness.localFile, local], [harness.globalFile, global]]) {
        if (content === undefined) {
          await rm(file, { force: true });
        } else {
          await writeTier(file, content);
        }
      }
    },

    /**
     * @param {string[]} argv - the CLI arguments.
     * @param {object} [options] - `runCli` overrides (e.g. `cwd`).
     * @returns {Promise<object>} the `runCli` outcome.
     */
    run(argv, options = {}) {
      return runCli(argv, {
        cwd: harness.root, env: harness.env, deps: harness.deps, version: '2.4.0', migrationVersions: MIGRATIONS, ...options
      });
    },

    /**
     * Runs `shortcut` then `generic`, each on freshly seeded tiers.
     * @param {string[]} shortcut - the shortcut's argv.
     * @param {string[]} generic - the generic command's argv.
     * @param {object} [tiers] - the tiers to seed before each run.
     * @param {object} [options] - `runCli` overrides.
     * @returns {Promise<{shortcut: object, generic: object}>} both outcomes.
     */
    async both(shortcut, generic, tiers = {}, options = {}) {
      await harness.seed(tiers);
      const first = await harness.run(shortcut, options);

      await harness.seed(tiers);
      const second = await harness.run(generic, options);

      return { shortcut: first, generic: second };
    }
  };

  return harness;
}

/**
 * @param {{code: number, out: string, err: string}} outcome - a `runCli` outcome.
 * @returns {{code: number, out: string, err: string}} the parts compared
 *   for byte-identity.
 */
export function observable({ code, out, err }) {
  return { code, out, err };
}
