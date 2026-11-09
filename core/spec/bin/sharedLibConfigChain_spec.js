import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Unit specs for config_chain_read's registry tier filter (issue #903):
// a key is skipped in a tier its arcanum/_lib/key_registry.sh lookup
// prints `false` for, and everything else behaves as the unfiltered
// local -> repo -> global chain.

const execFileAsync = promisify(execFile);
const CONFIG_CHAIN_LIB = path.join(REPO_ROOT, 'arcanum', '_lib', 'config_chain.sh');
const LOCAL_FILE = path.join('.claude', 'state', 'arcanum-config.json');
const REPO_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');

const REGISTRY = {
  format_version: 1,
  keys: [
    { key: 'ns.repo_global', tiers: ['repo', 'global'] },
    { key: 'ns.global_only', tiers: ['global'] },
    { key: 'ns.local_only', tiers: ['local'] },
    { key: 'ns.repo_only', tiers: ['repo'] },
    { key: 'ns.everywhere', tiers: ['local', 'repo', 'global'] }
  ]
};

describe('config_chain_read tier filter', () => {
  let repoPath;
  let globalDir;
  let registryFile;

  /**
   * @param {string} file - the config file path (absolute).
   * @param {object} namespaceValues - the `ns` namespace's content.
   * @returns {Promise<void>} resolves once written.
   */
  const writeTier = async (file, namespaceValues) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ ns: namespaceValues }));
  };

  /**
   * Seeds the three tiers with the given `ns` namespace contents.
   * @param {{local?: object, repo?: object, global?: object}} tiers - per-tier values.
   * @returns {Promise<void>} resolves once written.
   */
  const seedTiers = async ({ local = {}, repo = {}, global = {} }) => {
    await writeTier(path.join(repoPath, LOCAL_FILE), local);
    await writeTier(path.join(repoPath, REPO_FILE), repo);
    await writeTier(path.join(globalDir, 'arcanum-config.json'), global);
  };

  /**
   * @param {...string} keys - the keys (under `ns`) to read.
   * @returns {Promise<{stdout: string, stderr: string}>} the call's output.
   */
  const chainRead = (...keys) => execFileAsync('bash', [
    '-c',
    'cd "$1" && source "$2" && shift 2 && config_chain_read "$PWD" ns "$@"',
    'config-chain-spec', repoPath, CONFIG_CHAIN_LIB, ...keys
  ], { env: { ...process.env, CLAUDE_CONFIG_DIR: globalDir, KEY_REGISTRY_FILE: registryFile } });

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-core-spec-global-');
    registryFile = path.join(globalDir, 'keys.json');
    await writeFile(registryFile, JSON.stringify(REGISTRY));
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  it('skips a disallowed tier and resolves the next allowed one', async () => {
    await seedTiers({
      local: { repo_global: 'local' },
      repo: { repo_global: 'repo' },
      global: { repo_global: 'global' }
    });

    await expectAsync(chainRead('repo_global')).toBeResolvedTo({ stdout: '"repo"\n', stderr: '' });
  });

  it('resolves the global value of a global-only key set in every tier', async () => {
    await seedTiers({
      local: { global_only: 'local' },
      repo: { global_only: 'repo' },
      global: { global_only: 'global' }
    });

    await expectAsync(chainRead('global_only')).toBeResolvedTo({ stdout: '"global"\n', stderr: '' });
  });

  it('prints nothing when the value only lives in a disallowed tier', async () => {
    await seedTiers({ local: { repo_only: 'local' }, global: { repo_only: 'global' } });

    await expectAsync(chainRead('repo_only')).toBeResolvedTo({ stdout: '', stderr: '' });
  });

  it('resolves the second key in local when the first is disallowed there', async () => {
    await seedTiers({
      local: { repo_only: 'first-local', local_only: 'second-local' },
      repo: { repo_only: 'first-repo' }
    });

    await expectAsync(chainRead('repo_only', 'local_only'))
      .toBeResolvedTo({ stdout: '"second-local"\n', stderr: '' });
  });

  it('reads every tier for a key unknown to the registry', async () => {
    await seedTiers({
      local: { unknown: 'local' },
      repo: { unknown: 'repo' },
      global: { unknown: 'global' }
    });

    await expectAsync(chainRead('unknown')).toBeResolvedTo({ stdout: '"local"\n', stderr: '' });
  });

  it('falls through a null in an allowed tier to the next allowed tier', async () => {
    await seedTiers({
      local: { repo_global: 'local' },
      repo: { repo_global: null },
      global: { repo_global: 'global' }
    });

    await expectAsync(chainRead('repo_global')).toBeResolvedTo({ stdout: '"global"\n', stderr: '' });
  });

  it('stops the chain at an empty string in an allowed tier', async () => {
    await seedTiers({
      local: { everywhere: '' },
      repo: { everywhere: 'repo' },
      global: { everywhere: 'global' }
    });

    await expectAsync(chainRead('everywhere')).toBeResolvedTo({ stdout: '""\n', stderr: '' });
  });

  it('behaves as the unfiltered chain when the registry file is missing', async () => {
    registryFile = path.join(globalDir, 'missing.json');
    await seedTiers({
      local: { repo_global: 'local' },
      repo: { repo_global: 'repo' },
      global: { repo_global: 'global' }
    });

    await expectAsync(chainRead('repo_global')).toBeResolvedTo({ stdout: '"local"\n', stderr: '' });
  });
});
