import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for the two pending warn-only migrations of issue #907:
// `002` (global scope) warns about values in the global config file for
// keys newly readable from the global tier, `003` (local scope) about a
// local `auto-fix-all.ignored_check_patterns` that now overrides the
// repo value. Neither writes any file; both always exit 0 and print
// their warnings to stdout (the migrations runner discards stderr on
// success). The script paths are full string literals so
// `scripts/bump-version.sh` can rewrite them on release; `MANIFEST` is
// derived from them.
// NOT a parity spec: the migration scripts have no native counterpart.

const GLOBAL_SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/002.sh');
const LOCAL_SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/003.sh');
const MANIFEST = path.join(path.dirname(GLOBAL_SCRIPT), 'migrations.json');
const LOCAL_CONFIG = '.claude/state/arcanum-config.json';
const REPO_CONFIG = '.claude/configuration/arcanum-repo-config.json';
const GLOBAL_KEYS = [
  'git.safe_branch',
  'auto-fix-all.clear_context',
  'auto-fix-all.finish_on_empty_queue',
  'monitor-issues.clear_context'
];

/**
 * @param {string} file - the absolute file path.
 * @param {string} content - the raw content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeRaw(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

/**
 * @param {string} key - the dot-separated key.
 * @param {string} value - the compact JSON value.
 * @param {string} file - the global config file.
 * @returns {string} the expected `002` warning line.
 */
function globalWarning(key, value, file) {
  return `Warning: ${key} = ${value} in ${file} now takes effect (arcanum reads it from the global tier). `
    + `Remove it with: arcanum config unset ${key} --global\n`;
}

/**
 * @param {string} value - the compact JSON value.
 * @returns {string} the expected `003` warning line.
 */
function localWarning(value) {
  return `Warning: auto-fix-all.ignored_check_patterns = ${value} in ${LOCAL_CONFIG} now overrides the repo value `
    + '(arcanum reads it from the local tier). '
    + 'Remove it with: arcanum config unset auto-fix-all.ignored_check_patterns --local\n';
}

describe('newly effective tiers warn-only migrations', () => {
  let repoPath;
  let configDir;
  let globalFile;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-warn-tiers-repo-');
    configDir = await createTempDir('arcanum-core-warn-tiers-global-');
    globalFile = path.join(configDir, 'arcanum-config.json');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(configDir);
  });

  /**
   * @param {string} script - the migration script.
   * @param {string} subcommand - the migration's subcommand.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runMigration(script, subcommand) {
    return runCommand(['bash', script, subcommand], repoPath, { ...process.env, CLAUDE_CONFIG_DIR: configDir });
  }

  describe('migrations.json', () => {
    let manifest;

    beforeEach(async () => {
      manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
    });

    it('declares 002 as a skippable global-scoped script', () => {
      expect(manifest.find((item) => item.id === '002')).toEqual({
        id: '002', type: 'script', file: '002.sh', skippable: true, applies_to: 'global'
      });
    });

    it('declares 003 as a skippable local-scoped script', () => {
      expect(manifest.find((item) => item.id === '003')).toEqual({
        id: '003', type: 'script', file: '003.sh', skippable: true, applies_to: 'local'
      });
    });
  });

  [GLOBAL_SCRIPT, LOCAL_SCRIPT].forEach((script) => {
    describe(`${path.basename(script)} config`, () => {
      it('prints {"skippable": true}', async () => {
        const result = await runMigration(script, 'config');

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('{"skippable": true}\n');
      });
    });
  });

  describe('002 run (global tier)', () => {
    /**
     * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
     */
    function run() {
      return runMigration(GLOBAL_SCRIPT, 'run');
    }

    GLOBAL_KEYS.forEach((key) => {
      it(`warns about a global ${key}`, async () => {
        const [namespace, name] = key.split('.');

        await writeRaw(globalFile, JSON.stringify({ [namespace]: { [name]: true } }));

        const result = await run();

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(globalWarning(key, 'true', globalFile));
      });
    });

    it('warns once per present key, in order, with compact values, counting false as present', async () => {
      await writeRaw(globalFile, JSON.stringify({
        git: { safe_branch: 'develop' },
        'auto-fix-all': { clear_context: false, finish_on_empty_queue: null },
        'monitor-issues': { clear_context: { nested: [1, 2] } }
      }, null, 2));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(
        globalWarning('git.safe_branch', '"develop"', globalFile)
        + globalWarning('auto-fix-all.clear_context', 'false', globalFile)
        + globalWarning('monitor-issues.clear_context', '{"nested":[1,2]}', globalFile)
      );
    });

    it('prints nothing for null values', async () => {
      await writeRaw(globalFile, JSON.stringify({ git: { safe_branch: null }, 'auto-fix-all': null }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('prints nothing when the global file is absent', async () => {
      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('prints nothing for an empty object', async () => {
      await writeRaw(globalFile, '{}');

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('ignores keys whose tiers did not change', async () => {
      await writeRaw(globalFile, JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: ['x'] } }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    ['{not json', '[1, 2]'].forEach((content) => {
      it(`warns once and exits 0 for a malformed file (${content})`, async () => {
        await writeRaw(globalFile, content);

        const result = await run();

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(
          `Warning: could not read ${globalFile} (not a valid JSON object); `
          + 'skipped checking it for values that now take effect in the global tier.\n'
        );
      });
    });

    it('leaves the global file byte-for-byte unchanged', async () => {
      const content = '{ "git": {"safe_branch": "develop"},\n  "other": 1 }\n';

      await writeRaw(globalFile, content);
      await run();

      expect(await readFile(globalFile, 'utf8')).toEqual(content);
    });
  });

  describe('003 run (local tier)', () => {
    const localFile = () => path.join(repoPath, LOCAL_CONFIG);

    /**
     * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
     */
    function run() {
      return runMigration(LOCAL_SCRIPT, 'run');
    }

    it('warns about a local ignored_check_patterns', async () => {
      await writeRaw(localFile(), JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: ['^codacy', 'x'] } }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(localWarning('["^codacy","x"]'));
    });

    it('counts false as present', async () => {
      await writeRaw(localFile(), JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: false } }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(localWarning('false'));
    });

    it('prints nothing for a null value', async () => {
      await writeRaw(localFile(), JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: null } }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('prints nothing when the local file is absent', async () => {
      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('prints nothing for an empty object', async () => {
      await writeRaw(localFile(), '{}');

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('ignores ignored_check_patterns in the repo config', async () => {
      await writeRaw(
        path.join(repoPath, REPO_CONFIG),
        JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: ['x'] } })
      );

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('ignores the global file', async () => {
      await writeRaw(globalFile, JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: ['x'] } }));

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual('');
    });

    it('warns once and exits 0 for a malformed file', async () => {
      await writeRaw(localFile(), '{not json');

      const result = await run();

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(
        `Warning: could not read ${LOCAL_CONFIG} (not a valid JSON object); `
        + 'skipped checking it for values that now take effect in the local tier.\n'
      );
    });

    it('leaves the local file byte-for-byte unchanged', async () => {
      const content = '{ "auto-fix-all": {"ignored_check_patterns": ["x"]},\n  "other": 1 }\n';

      await writeRaw(localFile(), content);
      await run();

      expect(await readFile(localFile(), 'utf8')).toEqual(content);
    });
  });
});
