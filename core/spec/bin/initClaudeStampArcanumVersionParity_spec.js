import InstallVersion from '../../lib/utils/file/InstallVersion.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import {
  createParityDirs,
  expectInitClaudeParity,
  runInitClaudeBoth,
  seedFiles
} from '../support/utils/initClaudeParity.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "init-claude-stamp-arcanum-version" migrated
// entrypoint (issue #592) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// init-claude/scripts/stamp_arcanum_version_shell.sh (directly, NOT
// through the engine_dispatch shim) and `core/bin/arcanum
// init-claude-stamp-arcanum-version` against equivalent project dirs,
// asserting identical stdout/stderr/exit code and byte-identical files.
//
// Both sides resolve the version from the real install (this checkout):
// usually a git clone (or worktree) without an exact release tag, which
// exercises the silent no-op path. The stamping path itself is covered
// by InitClaudeStampArcanumVersion_spec.js.

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

describe('init-claude-stamp-arcanum-version parity (shell vs. native)', () => {
  let baseDir;
  let dirs;
  let stamps;

  beforeAll(async () => {
    stamps = SEMVER.test(await new InstallVersion().resolve(REPO_ROOT));
  });

  beforeEach(async () => {
    baseDir = await createTempDir();
    dirs = await createParityDirs(baseDir);
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  /**
   * @returns {Promise<Object<string, string>>} the resulting tree.
   */
  async function expectParityForInstall() {
    const results = await runInitClaudeBoth({
      script: 'stamp_arcanum_version',
      command: 'init-claude-stamp-arcanum-version',
      ...dirs
    });

    expect(results.shell.code).toEqual(0);
    expect(results.shell.stdout).toEqual('');

    return expectInitClaudeParity(results, dirs);
  }

  it('produces the same files (none, unless the install is on a release tag) in an empty project', async () => {
    const tree = await expectParityForInstall();

    if (!stamps) {
      expect(tree).toEqual({});
    }
  });

  it('leaves existing config files identical on both sides', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], {
      '.claude/configuration/arcanum-repo-config.json': '{"version":"0.1.0","auto-fix-all":{"x":1}}',
      '.claude/state/arcanum-config.json': '{"git":{"safe_branch":"origin/main"}}'
    });

    await expectParityForInstall();
  });
});
