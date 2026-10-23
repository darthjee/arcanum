import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { flatten } from '../../../../lib/commands/config/list.js';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config list', () => {
  let tmp;
  let account;
  let root;
  let env;

  const list = (...args) => runCli(['config', 'list', ...args], { cwd: root, env });

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    await mkdir(account);
    root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: { version: '2.1.0', engine: { mode: 'native' } } });
    await writeTier(path.join(root, LOCAL_FILE), { engine: { mode: 'shell' }, custom: { a: { b: 1 } } });
    await writeTier(path.join(account, 'arcanum-config.json'), { git: { email: 'g@x' } });
    env = { CLAUDE_CONFIG_DIR: account };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  it('lists one tier with registry descriptions', async () => {
    const result = await list('--repo');

    expect(result.code).toBe(0);
    expect(result.out).toBe([
      'version = "2.1.0"   Arcanum version the repo config was migrated to, managed by migrations and init-claude',
      'engine.mode = "native"   Script engine used to run migrated skill entrypoints',
      ''
    ].join('\n'));
  });

  it('lists every tier, a shadowed key once per tier', async () => {
    expect((await list('--json')).json()).toEqual({
      entries: [
        { key: 'engine.mode', tier: 'local', value: 'shell', known: true, description: jasmine.any(String) },
        { key: 'custom.a.b', tier: 'local', value: 1, known: false, description: null },
        { key: 'version', tier: 'repo', value: '2.1.0', known: true, description: jasmine.any(String) },
        { key: 'engine.mode', tier: 'repo', value: 'native', known: true, description: jasmine.any(String) },
        { key: 'git.email', tier: 'global', value: 'g@x', known: true, description: jasmine.any(String) }
      ]
    });
  });

  it('prefixes the tier without a tier flag', async () => {
    expect((await list()).out).toContain('local   custom.a.b = 1\n');
  });

  it('warns on a malformed tier and lists the others', async () => {
    await writeTier(path.join(root, LOCAL_FILE), 'null');

    const result = await list('--json');

    expect(result.code).toBe(0);
    expect(result.json().entries.map((entry) => entry.tier)).toEqual(['repo', 'repo', 'global']);
    expect(result.err).toContain('is not a JSON object');
  });

  it('lists the global tier only outside a repo', async () => {
    const result = await runCli(['config', 'list', '--json'], { cwd: account, env });

    expect(result.json().entries.map((entry) => entry.key)).toEqual(['git.email']);
    expect(result.err).toContain('global tier only');
  });

  it('exits 4 for --repo outside a repo', async () => {
    expect((await runCli(['config', 'list', '--repo'], { cwd: account, env })).code).toBe(4);
  });

  it('prints nothing for an empty tier', async () => {
    const result = await runCli(['config', 'list', '--global'], { cwd: root, env: { CLAUDE_CONFIG_DIR: tmp } });

    expect(result).toEqual(jasmine.objectContaining({ code: 0, out: '' }));
  });

  it('refuses a positional', async () => {
    expect((await list('extra')).code).toBe(2);
  });

  describe('flatten', () => {
    it('walks non-empty objects and keeps other values as leaves', () => {
      expect(flatten({ a: { b: { c: 1 }, e: {} }, n: null, l: [1] })).toEqual([
        ['a.b.c', 1], ['a.e', {}], ['n', null], ['l', [1]]
      ]);
    });
  });
});
