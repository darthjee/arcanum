import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ConfigChain from '../../../../../shared/lib/config/ConfigChain.js';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config get', () => {
  let tmp;
  let account;
  let root;
  let env;

  const get = (...args) => runCli(['config', 'get', ...args], { cwd: root, env });

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    await mkdir(account);
    root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: { engine: { mode: 'native' } } });
    env = { CLAUDE_CONFIG_DIR: account, HOME: tmp };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  describe('without a tier', () => {
    it('prints the resolved value and its source', async () => {
      const result = await get('engine.mode');

      expect(result).toEqual(jasmine.objectContaining({
        code: 0, out: `native   (repo: ${REPO_FILE})\n`, err: ''
      }));
    });

    it('resolves local before repo before global', async () => {
      await writeTier(path.join(account, 'arcanum-config.json'), { engine: { mode: 'docker' }, git: { email: 'g@x' } });
      await writeTier(path.join(root, LOCAL_FILE), { engine: { mode: 'shell' } });

      expect((await get('engine.mode', '--json')).json()).toEqual({
        key: 'engine.mode', set: true, value: 'shell', source: 'local', default: 'shell'
      });
      expect((await get('git.email')).out).toBe(`g@x   (global: ${path.join(account, 'arcanum-config.json')})\n`);
    });

    it('skips a null value, like ConfigChain', async () => {
      await writeTier(path.join(root, LOCAL_FILE), { engine: { mode: null } });

      expect((await get('engine.mode', '--json')).json().source).toBe('repo');
    });

    it('agrees with ConfigChain#readWithSource', async () => {
      await writeTier(path.join(account, 'arcanum-config.json'), { git: { email: 'g@x', merge_body_mode: 'full' } });
      await writeTier(path.join(root, LOCAL_FILE), { git: { merge_body_mode: 'coauthors' } });

      const chain = new ConfigChain({ env });

      for (const key of ['email', 'merge_body_mode']) {
        const expected = await chain.readWithSource(root, 'git', key);
        const actual = (await get(`git.${key}`, '--json')).json();

        expect({ value: actual.value, source: actual.source }).toEqual({ value: expected.value, source: expected.tier });
      }
    });

    it('prints an unset key with its default and exits 1', async () => {
      const result = await get('git.safe_branch');

      expect(result.code).toBe(1);
      expect(result.out).toBe('(unset; default: origin/main)\n');
    });

    it('prints an unset key with no default as (unset)', async () => {
      expect((await get('git.email')).out).toBe('(unset)\n');
    });

    it('prints the unset JSON shape and exits 1', async () => {
      const result = await get('git.email', '--json');

      expect(result.code).toBe(1);
      expect(result.json()).toEqual({ key: 'git.email', set: false, value: null, source: null, default: null });
      expect(result.err).toBe('');
    });

    it('reads an unknown key', async () => {
      await writeTier(path.join(root, REPO_FILE), { custom: { thing: [1, 2] } });

      expect((await get('custom.thing')).out).toBe(`[1,2]   (repo: ${REPO_FILE})\n`);
    });

    it('reads the global tier only, with a note, outside a repo', async () => {
      await writeTier(path.join(account, 'arcanum-config.json'), { engine: { mode: 'docker' } });

      const result = await runCli(['config', 'get', 'engine.mode'], { cwd: account, env });

      expect(result.code).toBe(0);
      expect(result.out).toContain('docker');
      expect(result.err).toContain('reading the global tier only');
    });

    it('warns on a malformed tier and resolves the others', async () => {
      await writeTier(path.join(root, LOCAL_FILE), '{oops');

      const result = await get('engine.mode');

      expect(result.code).toBe(0);
      expect(result.out).toContain('native');
      expect(result.err).toContain(`${path.join(root, LOCAL_FILE)} is not valid JSON`);
    });

    it('warns on a missing claude config dir and reads the other tiers', async () => {
      const result = await runCli(['config', 'get', 'engine.mode'], {
        cwd: root, env: { CLAUDE_CONFIG_DIR: path.join(tmp, 'typo') }
      });

      expect(result.code).toBe(0);
      expect(result.err).toContain(`claude config dir ${path.join(tmp, 'typo')} does not exist`);
    });

    it('warns on an unresolved account', async () => {
      const result = await runCli(['config', 'get', 'engine.mode'], { cwd: root, env: {} });

      expect(result.code).toBe(0);
      expect(result.err).toContain('no claude config dir resolved');
    });

    it('exits 4 when the claude config dir is a file', async () => {
      await writeFile(path.join(tmp, 'file'), '');

      const result = await runCli(['config', 'get', 'engine.mode'], {
        cwd: root, env: { CLAUDE_CONFIG_DIR: path.join(tmp, 'file') }
      });

      expect(result.code).toBe(4);
      expect(result.err).toContain('is not a directory');
    });
  });

  describe('with a tier flag', () => {
    it('prints the raw value only', async () => {
      await writeTier(path.join(root, REPO_FILE), { git: { remove_coauthors: ['a@x'] }, engine: { mode: 'native' } });

      expect((await get('engine.mode', '--repo')).out).toBe('native\n');
      expect((await get('git.remove_coauthors', '--repo')).out).toBe('["a@x"]\n');
    });

    it('reads only that tier', async () => {
      const result = await get('engine.mode', '--local');

      expect(result.code).toBe(1);
      expect(result.out).toBe('');
      expect(result.err).toContain('unset');
    });

    it('reports the tier as the source in JSON', async () => {
      expect((await get('engine.mode', '--repo', '--json')).json()).toEqual({
        key: 'engine.mode', set: true, value: 'native', source: 'repo', default: 'shell'
      });
    });

    it('treats a malformed tier as unset, with a warning, exit 1', async () => {
      await writeTier(path.join(root, REPO_FILE), '[1]');

      const result = await get('engine.mode', '--repo');

      expect(result.code).toBe(1);
      expect(result.out).toBe('');
      expect(result.err).toContain('is not a JSON object');
    });

    it('exits 4 for --local outside a repo', async () => {
      const result = await runCli(['config', 'get', 'engine.mode', '--local', '--json'], { cwd: account, env });

      expect(result.code).toBe(4);
      expect(JSON.parse(result.err).error.code).toBe('target_unavailable');
      expect(result.out).toBe('');
    });

    it('targets another repo with --repo=<path> --repo', async () => {
      const other = await makeRepo(path.join(tmp, 'other'), { repoConfig: { engine: { mode: 'docker' } } });

      expect((await runCli(['config', 'get', 'engine.mode', `--repo=${other}`, '--repo'], { cwd: tmp, env })).out)
        .toBe('docker\n');
    });

    it('reads the global tier with --claude-config-dir', async () => {
      const other = path.join(tmp, 'other-account');

      await writeTier(path.join(other, 'arcanum-config.json'), { engine: { mode: 'docker' } });

      expect((await get('engine.mode', '--global', '--claude-config-dir', other)).out).toBe('docker\n');
    });

    it('exits 2 for a --claude-config-dir that does not exist', async () => {
      expect((await get('engine.mode', '--claude-config-dir', path.join(tmp, 'nope'))).code).toBe(2);
    });
  });

  describe('--all-tiers', () => {
    it('prints every tier, shadowed ones included', async () => {
      await writeTier(path.join(account, 'arcanum-config.json'), { engine: { mode: 'docker' } });

      const result = await get('engine.mode', '--all-tiers');

      expect(result.code).toBe(0);
      expect(result.out).toBe([
        'local    -        (unset)',
        'repo     native   <- resolved',
        'global   docker',
        ''
      ].join('\n'));
    });

    it('prints the --all-tiers JSON shape', async () => {
      expect((await get('engine.mode', '--all-tiers', '--json')).json()).toEqual({
        key: 'engine.mode',
        resolved: { set: true, value: 'native', source: 'repo', default: 'shell' },
        tiers: {
          local: { set: false, value: null, file: path.join(root, LOCAL_FILE) },
          repo: { set: true, value: 'native', file: path.join(root, REPO_FILE) },
          global: { set: false, value: null, file: path.join(account, 'arcanum-config.json') }
        }
      });
    });

    it('reports file null for a tier with no target, exit 1 when unresolved', async () => {
      const result = await runCli(['config', 'get', 'git.email', '--all-tiers', '--json'], { cwd: account, env: {} });

      expect(result.code).toBe(1);
      expect(result.json().tiers).toEqual({
        local: { set: false, value: null, file: null },
        repo: { set: false, value: null, file: null },
        global: { set: false, value: null, file: null }
      });
    });

    it('refuses --all-tiers with a tier flag', async () => {
      const result = await get('engine.mode', '--all-tiers', '--repo');

      expect(result.code).toBe(2);
      expect(result.err).toContain('--all-tiers cannot be combined with --repo');
    });
  });

  it('accepts flags before the command', async () => {
    expect((await runCli(['--json', 'config', 'get', 'engine.mode'], { cwd: root, env })).json().value).toBe('native');
  });
});
