import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UsageError } from '../../lib/exitCodes.js';
import { expandHome, resolveClaudeConfigDir, resolveRepo, resolveTargets } from '../../lib/target.js';
import { makeRepo, removeDir, tmpDir } from '../support/fixtures.js';

describe('target', () => {
  let tmp;
  let warnings;
  const warn = (message) => warnings.push(message);

  beforeEach(async () => {
    tmp = await tmpDir();
    warnings = [];
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  describe('resolveClaudeConfigDir', () => {
    it('uses the flag over the env, expanding ~', async () => {
      await mkdir(path.join(tmp, '.claude-x'));

      const result = await resolveClaudeConfigDir({
        flag: '~/.claude-x', env: { HOME: tmp, CLAUDE_CONFIG_DIR: '/elsewhere' }, cwd: '/', warn
      });

      expect(result).toEqual({ dir: path.join(tmp, '.claude-x'), source: 'flag', state: 'ok' });
    });

    it('resolves a relative flag against the cwd', async () => {
      await mkdir(path.join(tmp, 'acct'));

      const result = await resolveClaudeConfigDir({ flag: 'acct', env: {}, cwd: tmp, warn });

      expect(result.dir).toBe(path.join(tmp, 'acct'));
    });

    it('refuses a flag naming a missing directory', async () => {
      await expectAsync(resolveClaudeConfigDir({ flag: path.join(tmp, 'nope'), env: {}, cwd: tmp, warn }))
        .toBeRejectedWithError(UsageError, /no such directory/);
    });

    it('refuses a flag naming a file', async () => {
      await writeFile(path.join(tmp, 'f'), '');

      await expectAsync(resolveClaudeConfigDir({ flag: path.join(tmp, 'f'), env: {}, cwd: tmp, warn }))
        .toBeRejectedWithError(UsageError, /not a directory/);
    });

    it('uses CLAUDE_CONFIG_DIR verbatim', async () => {
      const result = await resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: tmp, HOME: '/h' }, cwd: '/', warn });

      expect(result).toEqual({ dir: tmp, source: 'env', state: 'ok' });
      expect(warnings).toEqual([]);
    });

    it('warns on a CLAUDE_CONFIG_DIR starting with ~, without expanding it', async () => {
      const result = await resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: '~/.c', HOME: tmp }, cwd: tmp, warn });

      expect(result.dir).toBe(path.join(tmp, '~', '.c'));
      expect(result.state).toBe('missing');
      expect(warnings[0]).toContain('not expanded');
    });

    it('reports a CLAUDE_CONFIG_DIR that is a file', async () => {
      await writeFile(path.join(tmp, 'f'), '');

      const result = await resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: path.join(tmp, 'f') }, cwd: tmp, warn });

      expect(result.state).toBe('not_directory');
    });

    it('treats an empty CLAUDE_CONFIG_DIR as unset', async () => {
      const result = await resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: '', HOME: tmp }, cwd: '/', warn });

      expect(result).toEqual({ dir: path.join(tmp, '.claude'), source: 'default', state: 'missing' });
    });

    it('is unresolved with no flag, env or HOME', async () => {
      expect(await resolveClaudeConfigDir({ env: {}, cwd: '/', warn })).toEqual({
        dir: null, source: 'unresolved', state: 'unresolved'
      });
    });
  });

  describe('expandHome', () => {
    it('expands a bare ~', () => {
      expect(expandHome('~', { HOME: '/h' })).toBe('/h');
    });

    it('leaves other paths alone', () => {
      expect(expandHome('/a/~b', { HOME: '/h' })).toBe('/a/~b');
    });

    it('refuses ~user', () => {
      expect(() => expandHome('~bob/x', { HOME: '/h' })).toThrowError(UsageError, /~user/);
    });

    it('refuses ~ with no HOME', () => {
      expect(() => expandHome('~/x', {})).toThrowError(UsageError, /HOME unset/);
    });

    it('refuses an empty value', () => {
      expect(() => expandHome('', {})).toThrowError(UsageError, /needs a path/);
    });
  });

  describe('resolveRepo', () => {
    it('resolves the cwd\'s repo root from a subdirectory', async () => {
      const root = await makeRepo(path.join(tmp, 'repo'));
      const sub = path.join(root, 'a', 'b');

      await mkdir(sub, { recursive: true });

      expect(await resolveRepo({ cwd: sub, warn })).toEqual({
        root, source: 'cwd', path: sub, configured: true
      });
    });

    it('resolves a --repo path against the cwd', async () => {
      const root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: null });

      expect(await resolveRepo({ flag: 'repo', cwd: tmp, warn })).toEqual({
        root, source: 'flag', path: root, configured: false
      });
    });

    it('reports no repo outside a git repo', async () => {
      const result = await resolveRepo({ flag: tmp, cwd: '/', warn });

      expect(result.root).toBeNull();
      expect(result.configured).toBeFalse();
      expect(warnings).toEqual([]);
    });

    it('refuses a non-existent --repo path', async () => {
      await expectAsync(resolveRepo({ flag: path.join(tmp, 'nope'), cwd: '/', warn }))
        .toBeRejectedWithError(UsageError, /^not a directory: /);
    });

    it('refuses a --repo path that is a file', async () => {
      await writeFile(path.join(tmp, 'f'), '');

      await expectAsync(resolveRepo({ flag: path.join(tmp, 'f'), cwd: '/', warn }))
        .toBeRejectedWithError(UsageError, /not a directory/);
    });

    it('reports no repo, with a warning, when git is not on PATH', async () => {
      const execFileAsync = () => Promise.reject(Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }));
      const result = await resolveRepo({ cwd: tmp, warn, execFileAsync });

      expect(result.root).toBeNull();
      expect(warnings[0]).toContain('git not found');
    });
  });

  describe('resolveTargets', () => {
    it('resolves the account and the repo', async () => {
      const root = await makeRepo(path.join(tmp, 'repo'));
      const result = await resolveTargets({ env: { CLAUDE_CONFIG_DIR: tmp }, cwd: root, warn });

      expect(result.account.source).toBe('env');
      expect(result.repo.root).toBe(root);
    });
  });
});
