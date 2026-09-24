import {
  createParityDirs,
  expectInitClaudeParity,
  runInitClaudeBoth,
  seedFiles
} from '../support/utils/initClaudeParity.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "init-claude-set-ci-ignored-patterns" migrated
// entrypoint (issue #592) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// init-claude/scripts/set_ci_ignored_patterns_shell.sh (directly, NOT
// through the engine_dispatch shim) and `core/bin/arcanum
// init-claude-set-ci-ignored-patterns` against equivalent project dirs,
// asserting identical stdout/stderr/exit code and byte-identical files.

const CONFIG = '.claude/configuration/arcanum-repo-config.json';
const LEGACY = '.claude/configuration/auto-fix-all.json';

describe('init-claude-set-ci-ignored-patterns parity (shell vs. native)', () => {
  let baseDir;
  let dirs;

  beforeEach(async () => {
    baseDir = await createTempDir();
    dirs = await createParityDirs(baseDir);
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  /**
   * @param {string[]} args - the entrypoint's arguments.
   * @returns {Promise<Object<string, string>>} the resulting tree.
   */
  async function expectParityFor(args) {
    const results = await runInitClaudeBoth({
      script: 'set_ci_ignored_patterns',
      command: 'init-claude-set-ci-ignored-patterns',
      args,
      ...dirs
    });

    expect(results.shell.code).toEqual(0);

    return expectInitClaudeParity(results, dirs);
  }

  it('creates a new config file with multiple patterns', async () => {
    const tree = await expectParityFor(['lint', 'coverage/*', 'a b']);

    expect(JSON.parse(tree[CONFIG])).toEqual({
      'auto-fix-all': { ignored_check_patterns: ['lint', 'coverage/*', 'a b'] }
    });
  });

  it('writes [] for --clear', async () => {
    const tree = await expectParityFor(['--clear']);

    expect(JSON.parse(tree[CONFIG])).toEqual({ 'auto-fix-all': { ignored_check_patterns: [] } });
  });

  it('treats --clear alongside other args as a literal pattern', async () => {
    await expectParityFor(['--clear', 'lint']);
  });

  it('preserves other namespaces in an existing file', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], {
      [CONFIG]: '{"version":"1.0.0","auto-fix-all":{"auto_merge":true,"ignored_check_patterns":["x"]},"git":{"agents":{"a":"b"}}}'
    });

    await expectParityFor(['lint']);
  });

  it('seeds the namespace from the legacy auto-fix-all.json', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], {
      [CONFIG]: '{"version":"1.0.0"}',
      [LEGACY]: '{"auto_merge":true,"ignored_check_patterns":["old"]}'
    });

    const tree = await expectParityFor(['lint']);

    expect(JSON.parse(tree[CONFIG])['auto-fix-all']).toEqual({ auto_merge: true, ignored_check_patterns: ['lint'] });
  });

  it('treats an invalid-JSON config file as {}', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], { [CONFIG]: 'not json' });

    await expectParityFor(['lint']);
  });

  it('splits an argument containing a newline into several patterns', async () => {
    const tree = await expectParityFor(['a\nb', 'c']);

    expect(JSON.parse(tree[CONFIG])['auto-fix-all'].ignored_check_patterns).toEqual(['a', 'b', 'c']);
  });
});
