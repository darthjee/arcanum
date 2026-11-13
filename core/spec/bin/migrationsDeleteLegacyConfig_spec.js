import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for the pending per-repo migration that seeds the
// `auto-fix-all` namespace of the committed repo config from the legacy
// `.claude/configuration/auto-fix-all.json`, then deletes that file and
// `.claude/configuration/monitor-issues.json` (issue #906). The script
// path is one full string literal so `scripts/bump-version.sh` can
// rewrite it on release; `MANIFEST` is derived from `SCRIPT`.
// NOT a parity spec: the migration script has no native counterpart.
// It runs with cwd = a plain temp directory, the target repo.

const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh');
const MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json');
const CONFIG_DIR = path.join('.claude', 'configuration');
const REPO_CONFIG = path.join(CONFIG_DIR, 'arcanum-repo-config.json');
const LEGACY_AUTO_FIX_ALL = path.join(CONFIG_DIR, 'auto-fix-all.json');
const LEGACY_MONITOR_ISSUES = path.join(CONFIG_DIR, 'monitor-issues.json');

describe('legacy config files deletion migration', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-delete-legacy-config-migration-');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} subcommand - the migration's subcommand.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runMigration(subcommand) {
    return runCommand(['bash', SCRIPT, subcommand], repoPath);
  }

  /**
   * @param {string} relative - the file path under the repo.
   * @param {string} content - the raw content.
   * @returns {Promise<void>} resolves once written.
   */
  async function writeRaw(relative, content) {
    const file = path.join(repoPath, relative);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }

  /**
   * @param {string} relative - the file path under the repo.
   * @param {unknown} content - the JSON content.
   * @returns {Promise<void>} resolves once written.
   */
  function writeJson(relative, content) {
    return writeRaw(relative, JSON.stringify(content));
  }

  /**
   * @param {string} relative - the file path under the repo.
   * @returns {Promise<unknown>} the parsed JSON content.
   */
  async function readJson(relative) {
    return JSON.parse(await readFile(path.join(repoPath, relative), 'utf8'));
  }

  /**
   * @param {string} relative - the file path under the repo.
   * @returns {Promise<string|null>} the raw content, or `null` if absent.
   */
  async function readOptional(relative) {
    try {
      return await readFile(path.join(repoPath, relative), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * @param {string} relative - the path under the repo.
   * @returns {Promise<boolean>} whether the path exists.
   */
  async function exists(relative) {
    try {
      await stat(path.join(repoPath, relative));
      return true;
    } catch {
      return false;
    }
  }

  describe('config', () => {
    it('prints {"skippable": true}', async () => {
      const result = await runMigration('config');

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('{"skippable": true}\n');
    });
  });

  describe('migrations.json', () => {
    it('declares a skippable repo-scoped script entry for 001', async () => {
      const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
      const entry = manifest.find((item) => item.id === '001');

      expect(entry).toEqual({
        id: '001',
        type: 'script',
        file: '001.sh',
        skippable: true,
        applies_to: 'repo'
      });
    });
  });

  describe('run', () => {
    it('seeds the auto-fix-all namespace from the legacy file, preserving other keys, and deletes it', async () => {
      await writeJson(LEGACY_AUTO_FIX_ALL, { ignore_checks: ['codacy'] });
      await writeJson(REPO_CONFIG, { next_step: { auto: true } });

      const result = await runMigration('run');

      expect(result.code).toEqual(0);
      expect(await readJson(REPO_CONFIG)).toEqual({
        next_step: { auto: true },
        'auto-fix-all': { ignore_checks: ['codacy'] }
      });
      expect(await exists(LEGACY_AUTO_FIX_ALL)).toBeFalse();
    });

    it('leaves an existing auto-fix-all namespace unchanged and still deletes the legacy file', async () => {
      await writeJson(LEGACY_AUTO_FIX_ALL, { ignore_checks: ['codacy'] });
      await writeJson(REPO_CONFIG, { 'auto-fix-all': { ignore_checks: ['Codacy'] } });

      const result = await runMigration('run');

      expect(result.code).toEqual(0);
      expect(await readJson(REPO_CONFIG)).toEqual({ 'auto-fix-all': { ignore_checks: ['Codacy'] } });
      expect(await exists(LEGACY_AUTO_FIX_ALL)).toBeFalse();
    });

    it('deletes monitor-issues.json without seeding anything from it', async () => {
      await writeJson(LEGACY_MONITOR_ISSUES, { clear_context: true });

      const result = await runMigration('run');

      expect(result.code).toEqual(0);
      expect(await exists(LEGACY_MONITOR_ISSUES)).toBeFalse();
      expect(await readOptional(REPO_CONFIG)).toBeNull();
    });

    it('creates nothing when neither legacy file exists', async () => {
      await mkdir(path.join(repoPath, CONFIG_DIR), { recursive: true });

      const result = await runMigration('run');

      expect(result.code).toEqual(0);
      expect(await readOptional(REPO_CONFIG)).toBeNull();
    });

    it('keeps the .claude/configuration folder in place', async () => {
      await writeJson(LEGACY_AUTO_FIX_ALL, { ignore_checks: ['codacy'] });
      await writeJson(LEGACY_MONITOR_ISSUES, { clear_context: true });

      const result = await runMigration('run');

      expect(result.code).toEqual(0);
      expect(await exists(CONFIG_DIR)).toBeTrue();
    });

    it('fails without deleting anything when the legacy auto-fix-all.json is invalid JSON', async () => {
      await writeRaw(LEGACY_AUTO_FIX_ALL, '{not json');
      await writeJson(LEGACY_MONITOR_ISSUES, { clear_context: true });

      const result = await runMigration('run');

      expect(result.code).not.toEqual(0);
      expect(await exists(LEGACY_AUTO_FIX_ALL)).toBeTrue();
      expect(await exists(LEGACY_MONITOR_ISSUES)).toBeTrue();
    });

    it('is a no-op on a second run', async () => {
      await writeJson(LEGACY_AUTO_FIX_ALL, { ignore_checks: ['codacy'] });
      await writeJson(LEGACY_MONITOR_ISSUES, { clear_context: true });

      await runMigration('run');
      const first = await readOptional(REPO_CONFIG);
      const second = await runMigration('run');

      expect(second.code).toEqual(0);
      expect(await readOptional(REPO_CONFIG)).toEqual(first);
    });
  });
});
