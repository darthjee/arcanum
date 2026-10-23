import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config info', () => {
  const migrationVersions = { repo: ['2.0.0'], local: ['1.0.0', '2.1.0', '2.4.0'], global: ['2.4.0'] };
  const deps = { nodeVersion: '22.14.0' };
  let tmp;
  let account;
  let root;
  let env;

  const info = (args, options = {}) => runCli(['config', 'info', ...args], {
    cwd: root, env, version: '2.4.0', migrationVersions, deps, ...options
  });

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    await mkdir(account);
    await writeTier(path.join(account, 'arcanum-config.json'), { migrations: { version: '2.3.0' } });
    root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: { version: '2.4.0' } });
    env = { CLAUDE_CONFIG_DIR: account };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  it('prints the human report', async () => {
    const result = await info([]);

    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out).toBe([
      'arcanum-cli 2.4.0 (node 22.14.0, requires >=22.13.0)',
      '',
      'Account',
      `  claude config dir  ${account}   (from: env CLAUDE_CONFIG_DIR)`,
      `  global config      ${path.join(account, 'arcanum-config.json')}   [exists]`,
      '  global version     2.3.0   behind — 1 pending migration, run /arcanum-migrate',
      '',
      'Repo',
      `  root           ${root}   (from: cwd)`,
      `  repo config    ${REPO_FILE}   [exists]`,
      '  repo version   2.4.0   up to date',
      `  local config   ${LOCAL_FILE}   [missing]`,
      '  local version  0.0.0 (no pointer)   behind — 3 pending migrations, run /arcanum-migrate',
      ''
    ].join('\n'));
  });

  it('prints the JSON shape', async () => {
    expect((await info(['--json'])).json()).toEqual({
      cli: { version: '2.4.0', node: '22.14.0', node_floor: '>=22.13.0' },
      account: {
        claude_config_dir: account, source: 'env',
        file: path.join(account, 'arcanum-config.json'), exists: true,
        version: '2.3.0', skew: { status: 'behind', pending: 1 }
      },
      repo: {
        root, source: 'cwd',
        repo_config: {
          file: path.join(root, REPO_FILE), exists: true, version: '2.4.0', skew: { status: 'up_to_date', pending: 0 }
        },
        local_config: {
          file: path.join(root, LOCAL_FILE), exists: false, version: '0.0.0', skew: { status: 'behind', pending: 3 }
        }
      }
    });
  });

  it('reports a tier ahead of the CLI', async () => {
    await writeTier(path.join(root, REPO_FILE), { version: '2.5.0' });

    const result = await info([]);

    expect(result.out).toContain('repo version   2.5.0   ahead — writes refused without --force');
    expect(result.err).toBe('');
  });

  it('reports a malformed file', async () => {
    await writeTier(path.join(root, LOCAL_FILE), '{oops');

    const result = await info(['--json']);

    expect(result.code).toBe(0);
    expect(result.json().repo.local_config).toEqual({
      file: path.join(root, LOCAL_FILE), exists: true, malformed: true, version: null, skew: null
    });
    expect((await info([])).out).toContain('local version  unknown (malformed file)');
  });

  it('reports no repo as null, exit 0', async () => {
    const result = await info(['--json'], { cwd: account });

    expect(result.code).toBe(0);
    expect(result.json().repo).toBeNull();
    expect((await info([], { cwd: account })).out).toContain(`root  (no repo at ${account})`);
  });

  it('reports an unresolved account, exit 0', async () => {
    const result = await info(['--json'], { env: {} });

    expect(result.code).toBe(0);
    expect(result.json().account).toEqual({
      claude_config_dir: null, source: 'unresolved', file: null, exists: false, version: null, skew: null
    });
    expect((await info([], { env: {} })).out).toContain('(unresolved: CLAUDE_CONFIG_DIR and HOME are unset)');
  });

  it('reports the default account and a missing directory', async () => {
    const json = (await info(['--json'], { env: { HOME: tmp } })).json();

    expect(json.account).toEqual(jasmine.objectContaining({
      claude_config_dir: path.join(tmp, '.claude'), source: 'default', exists: false
    }));
  });

  it('reports the flag sources', async () => {
    const result = await info(['--claude-config-dir', account, `--repo=${root}`], { cwd: tmp });

    expect(result.out).toContain('(from: --claude-config-dir)');
    expect(result.out).toContain('(from: --repo)');
  });

  it('exits 2 on a tier flag', async () => {
    expect((await info(['--global'])).code).toBe(2);
  });
});
