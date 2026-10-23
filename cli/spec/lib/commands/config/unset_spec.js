import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { hasPath } from '../../../../lib/commands/config/unset.js';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config unset', () => {
  let tmp;
  let account;
  let root;
  let localFile;
  let env;
  let deps;

  const unset = (args, options = {}) => runCli(['config', 'unset', ...args], {
    cwd: root, env, deps, version: '2.4.0', migrationVersions: { repo: [], local: [], global: [] }, ...options
  });

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    await mkdir(account);
    root = await makeRepo(path.join(tmp, 'repo'), {
      repoConfig: { version: '2.4.0' },
      localConfig: { git: { safe_branch: 'origin/dev', email: 'a@x' }, custom: { only: 1 } }
    });
    localFile = path.join(root, LOCAL_FILE);
    env = { CLAUDE_CONFIG_DIR: account };
    deps = { lock: new Lock({ sleepMs: 10 }), signals: { on: () => {}, off: () => {}, exit: () => {} } };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  it('removes a key, keeping its siblings', async () => {
    const result = await unset(['git.safe_branch', '--local']);

    expect(result.code).toBe(0);
    expect(result.out).toBe(`unset git.safe_branch   (local: ${LOCAL_FILE}, was: origin/dev)\n`);
    expect(JSON.parse(await readFile(localFile, 'utf8'))).toEqual({ git: { email: 'a@x' }, custom: { only: 1 } });
  });

  it('prints the JSON shape', async () => {
    expect((await unset(['git.safe_branch', '--local', '--json'])).json()).toEqual({
      key: 'git.safe_branch', tier: 'local', file: localFile,
      changed: true, previous: { set: true, value: 'origin/dev' }, value: null, forced: false
    });
  });

  it('leaves an emptied parent in place', async () => {
    await unset(['custom.only', '--local', '--force']);

    expect(JSON.parse(await readFile(localFile, 'utf8')).custom).toEqual({});
  });

  it('is a no-op, exit 0, for a key that is not set', async () => {
    const before = await readFile(localFile, 'utf8');
    const result = await unset(['git.email', '--global', '--json']);

    expect(result.code).toBe(0);
    expect(result.json()).toEqual(jasmine.objectContaining({ changed: false, previous: { set: false, value: null } }));
    expect(await readFile(localFile, 'utf8')).toBe(before);
    await expectAsync(readFile(path.join(account, 'arcanum-config.json'))).toBeRejected();
  });

  it('prints the no-op in human mode', async () => {
    expect((await unset(['engine.mode', '--repo'])).out).toBe(`engine.mode was not set   (repo: ${REPO_FILE})\n`);
  });

  it('removes a top-level key', async () => {
    await unset(['custom', '--local', '--force']);

    expect(JSON.parse(await readFile(localFile, 'utf8'))).toEqual({ git: { safe_branch: 'origin/dev', email: 'a@x' } });
  });

  it('needs a tier (exit 2)', async () => {
    expect((await unset(['git.email'])).err).toContain('unset needs a tier: --global, --repo or --local');
  });

  it('refuses --string (exit 2)', async () => {
    expect((await unset(['git.email', '--local', '--string'])).code).toBe(2);
  });

  it('refuses no repo (exit 4)', async () => {
    expect((await unset(['git.email', '--repo'], { cwd: account })).code).toBe(4);
  });

  it('refuses a malformed file, bytes unchanged (exit 7)', async () => {
    await writeTier(localFile, '{oops');

    expect((await unset(['git.email', '--local'])).code).toBe(7);
    expect(await readFile(localFile, 'utf8')).toBe('{oops');
  });

  it('refuses an unknown key without --force (exit 3)', async () => {
    const result = await unset(['custom.only', '--local']);

    expect(result.code).toBe(3);
    expect(result.err).toContain('unknown key \'custom.only\'');
  });

  it('refuses a read-only key, even with --force (exit 3)', async () => {
    expect((await unset(['version', '--repo', '--force'])).code).toBe(3);
  });

  it('refuses a wrong tier (exit 3)', async () => {
    expect((await unset(['git.safe_branch', '--global'])).err).toContain('git.safe_branch is local-only');
  });

  it('refuses a tier ahead of the CLI without --force (exit 5)', async () => {
    await writeTier(localFile, { migrations: { version: '3.0.0' }, git: { email: 'a@x' } });

    expect((await unset(['git.email', '--local'])).code).toBe(5);
    expect((await unset(['git.email', '--local', '--force', '--json'])).json().forced).toBeTrue();
  });

  it('times out on a held lock (exit 6)', async () => {
    await writeFile(`${localFile}.lock`, `${os.hostname()}:${process.pid}:held\n`);

    const result = await unset(['git.email', '--local', '--lock-timeout', '0']);

    expect(result.code).toBe(6);
    expect(result.err).toContain(`waiting for ${localFile}.lock`);
    await rm(`${localFile}.lock`);
  });

  describe('hasPath', () => {
    it('sees a key holding null', () => {
      expect(hasPath({ a: { b: null } }, 'a.b')).toBeTrue();
      expect(hasPath({ a: 'x' }, 'a.b')).toBeFalse();
      expect(hasPath({}, 'a')).toBeFalse();
    });
  });
});
