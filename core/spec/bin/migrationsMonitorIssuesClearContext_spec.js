import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for the pending local migration that carries
// monitor-issues' `clear_context` from the legacy
// `.claude/state/monitor-issues-config.json` into the `monitor-issues`
// namespace of `.claude/state/arcanum-config.json` (issue #776). The
// script path is one full string literal so `scripts/bump-version.sh`
// can rewrite it on release.
// NOT a parity spec: the migration script has no native counterpart.
// It runs with cwd = a plain temp directory, the target repo.

const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh');
const NEW_STATE = path.join('.claude', 'state', 'arcanum-config.json');
const LEGACY_STATE = path.join('.claude', 'state', 'monitor-issues-config.json');

describe('monitor-issues clear_context migration (next/001)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-mi-clear-context-migration-');
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
   * @param {unknown} content - the JSON content.
   * @returns {Promise<void>} resolves once written.
   */
  async function writeJson(relative, content) {
    const file = path.join(repoPath, relative);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
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

  it('config prints {"skippable": false}', async () => {
    const result = await runMigration('config');

    expect(result.code).toEqual(0);
    expect(JSON.parse(result.stdout)).toEqual({ skippable: false });
    expect(result.stdout).toEqual('{"skippable": false}\n');
  });

  it('run seeds the monitor-issues namespace from the legacy file, preserving other keys', async () => {
    await writeJson(LEGACY_STATE, { clear_context: true });
    await writeJson(NEW_STATE, { 'auto-fix-all': { clear_context: false }, next_step: { auto: { x: true } } });

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readJson(NEW_STATE)).toEqual({
      'auto-fix-all': { clear_context: false },
      next_step: { auto: { x: true } },
      'monitor-issues': { clear_context: true }
    });
  });

  it('run creates the new state file when only the legacy file exists', async () => {
    await writeJson(LEGACY_STATE, { clear_context: true });

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readJson(NEW_STATE)).toEqual({ 'monitor-issues': { clear_context: true } });
  });

  it('run is a no-op when the monitor-issues namespace already exists', async () => {
    await writeJson(LEGACY_STATE, { clear_context: true });
    await writeJson(NEW_STATE, { 'monitor-issues': { clear_context: false } });

    const before = await readOptional(NEW_STATE);
    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readOptional(NEW_STATE)).toEqual(before);
  });

  it('run is a no-op when the legacy file is absent', async () => {
    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readOptional(NEW_STATE)).toBeNull();
  });

  it('run is idempotent', async () => {
    await writeJson(LEGACY_STATE, { clear_context: true });

    await runMigration('run');
    const first = await readOptional(NEW_STATE);
    const second = await runMigration('run');

    expect(second.code).toEqual(0);
    expect(await readOptional(NEW_STATE)).toEqual(first);
  });

  it('run never deletes the legacy file', async () => {
    await writeJson(LEGACY_STATE, { clear_context: true });

    await runMigration('run');

    expect(await readJson(LEGACY_STATE)).toEqual({ clear_context: true });
  });

  it('exits 1 with the usage message on an unknown subcommand', async () => {
    const result = await runMigration('bogus');

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('Usage:');
  });
});
