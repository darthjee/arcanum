import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config doctor', () => {
  let tmp;
  let account;
  let root;
  let env;

  const doctor = (...args) => runCli(['config', 'doctor', ...args], { cwd: root, env });

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    await mkdir(account);
    root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: { engine: { mode: 'native' } } });
    env = { CLAUDE_CONFIG_DIR: account };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  it('reports a clean config', async () => {
    await writeTier(path.join(account, 'arcanum-config.json'), { git: { email: 'g@x' } });

    const result = await doctor();

    expect(result.code).toBe(0);
    expect(result.out).toContain('no problems found');
  });

  it('reports a value in a disallowed tier', async () => {
    await writeTier(path.join(root, REPO_FILE), { git: { safe_branch: 'origin/dev' } });

    const result = await doctor('--json');

    expect(result.code).toBe(3);
    expect(result.json().problems).toEqual([jasmine.objectContaining({
      tier: 'repo',
      key: 'git.safe_branch',
      value: 'origin/dev',
      kind: 'tier',
      allowed_tiers: jasmine.any(Array),
      hint: jasmine.stringContaining('arcanum config unset git.safe_branch --repo')
    })]);
  });

  it('prints the human report grouped by tier', async () => {
    await writeTier(path.join(root, REPO_FILE), { git: { safe_branch: 'origin/dev' } });

    const result = await doctor();

    expect(result.out).toContain('git.safe_branch = "origin/dev"   ignored: tier not allowed (allowed: ');
    expect(result.out).toContain('    hint: arcanum config set git.safe_branch');
  });

  it('reports an unknown key', async () => {
    await writeTier(path.join(root, LOCAL_FILE), { custom: { a: 1 } });

    const result = await doctor('--json');

    expect(result.code).toBe(3);
    expect(result.json().problems).toEqual([jasmine.objectContaining({
      tier: 'local',
      key: 'custom.a',
      kind: 'unknown',
      hint: 'arcanum config unset custom.a --local'
    })]);
  });

  it('reports invalid values', async () => {
    await writeTier(path.join(root, REPO_FILE), { engine: { mode: 'bogus' } });
    await writeTier(path.join(account, 'arcanum-config.json'), { git: { email: 5 } });

    const result = await doctor('--json');
    const { problems } = result.json();

    expect(result.code).toBe(3);
    expect(problems.map((problem) => [problem.key, problem.kind, typeof problem.reason])).toEqual([
      ['engine.mode', 'invalid', 'string'],
      ['git.email', 'invalid', 'string']
    ]);
  });

  it('does not report read-only keys', async () => {
    await writeTier(path.join(root, REPO_FILE), { version: '2.1.0' });
    await writeTier(path.join(root, LOCAL_FILE), { migrations: { version: '2.1.0' } });
    await writeTier(path.join(account, 'arcanum-config.json'), { migrations: { version: '2.1.0' } });

    const result = await doctor('--json');

    expect(result.code).toBe(0);
    expect(result.json().problems).toEqual([]);
  });

  it('does not report null values or empty objects', async () => {
    await writeTier(path.join(root, LOCAL_FILE), { custom: null, other: {}, engine: { mode: null } });

    const result = await doctor('--json');

    expect(result.code).toBe(0);
    expect(result.json().problems).toEqual([]);
  });

  it('lists a missing tier as skipped', async () => {
    const result = await doctor('--json');

    expect(result.code).toBe(0);
    expect(result.json().skipped.map((entry) => entry.tier)).toEqual(['local', 'global']);
    expect(result.json().malformed).toEqual([]);
  });

  it('lists a malformed tier, scans the others and exits 7', async () => {
    await writeTier(path.join(root, LOCAL_FILE), '{ not json');
    await writeTier(path.join(root, REPO_FILE), { git: { safe_branch: 'origin/dev' } });

    const result = await doctor('--json');
    const report = result.json();

    expect(result.code).toBe(7);
    expect(report.malformed).toEqual([jasmine.objectContaining({ tier: 'local', file: path.join(root, LOCAL_FILE) })]);
    expect(report.problems.map((problem) => problem.key)).toEqual(['git.safe_branch']);
  });

  it('notes a malformed tier in the human report', async () => {
    await writeTier(path.join(root, LOCAL_FILE), '{ not json');

    expect((await doctor()).out).toContain('local (.claude/state/arcanum-config.json): malformed, not scanned');
  });

  it('refuses a tier flag', async () => {
    const result = await doctor('--repo');

    expect(result.code).toBe(2);
    expect(result.err).toContain('--repo is not accepted by doctor');
  });
});
