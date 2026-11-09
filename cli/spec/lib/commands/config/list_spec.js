import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { flatten } from '../../../../lib/commands/config/list.js';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

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
        { key: 'engine.mode', tier: 'local', value: 'shell', known: true, description: jasmine.any(String), allowed: true },
        { key: 'custom.a.b', tier: 'local', value: 1, known: false, description: null },
        { key: 'version', tier: 'repo', value: '2.1.0', known: true, description: jasmine.any(String), allowed: true },
        { key: 'engine.mode', tier: 'repo', value: 'native', known: true, description: jasmine.any(String), allowed: true },
        { key: 'git.email', tier: 'global', value: 'g@x', known: true, description: jasmine.any(String), allowed: true }
      ]
    });
  });

  it('prefixes the tier without a tier flag', async () => {
    expect((await list()).out).toContain('local   custom.a.b = 1\n');
  });

  describe('a key set in a tier it is not allowed in', () => {
    beforeEach(async () => {
      await writeTier(path.join(root, REPO_FILE), { git: { safe_branch: 'origin/dev' } });
    });

    it('marks the human line before the description', async () => {
      expect((await list('--repo')).out).toBe(
        'git.safe_branch = "origin/dev"   (ignored: tier not allowed)   Branch treated as the safe base for new work\n'
      );
    });

    it('marks the line with the tier prefix too', async () => {
      expect((await list()).out).toContain('repo    git.safe_branch = "origin/dev"   (ignored: tier not allowed)   ');
    });

    it('reports allowed: false in JSON', async () => {
      expect((await list('--repo', '--json')).json().entries).toEqual([
        { key: 'git.safe_branch', tier: 'repo', value: 'origin/dev', known: true, description: jasmine.any(String), allowed: false }
      ]);
    });
  });

  it('does not mark an allowed or unknown key', async () => {
    expect((await list('--local')).out).not.toContain('ignored');
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
