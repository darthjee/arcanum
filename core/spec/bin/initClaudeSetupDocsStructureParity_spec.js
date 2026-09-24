import {
  createParityDirs,
  expectInitClaudeParity,
  runInitClaudeBoth,
  seedFiles
} from '../support/utils/initClaudeParity.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "init-claude-setup-docs-structure" migrated
// entrypoint (issue #593) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// init-claude/scripts/setup_docs_structure_shell.sh (directly, NOT through
// the engine_dispatch shim) and `core/bin/arcanum
// init-claude-setup-docs-structure` against equivalent project dirs,
// asserting identical stdout/stderr/exit code and byte-identical files.

const PATHS = [
  'docs/agents/issues/.gitkeep',
  'docs/agents/plans/.gitkeep',
  'docs/agents/architecture.md',
  'docs/agents/flow.md',
  'docs/agents/issue-enhancement.md',
  'docs/agents/arcanum-split-issue.md'
];

describe('init-claude-setup-docs-structure parity (shell vs. native)', () => {
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
   * @returns {Promise<{shell: object, native: object}>} both sides' results.
   */
  async function runBoth() {
    const results = await runInitClaudeBoth({
      script: 'setup_docs_structure',
      command: 'init-claude-setup-docs-structure',
      ...dirs
    });

    await expectInitClaudeParity(results, dirs);

    return results;
  }

  /**
   * @param {string[]} paths - relative paths.
   * @returns {string} the indented listing lines.
   */
  function listing(paths) {
    return paths.map((file) => `  ${file}\n`).join('');
  }

  it('sets up a fresh repo', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], { 'AGENTS.md': '# Agents\n' });

    const { shell } = await runBoth();

    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual(`Created:\n${listing(PATHS)}AGENTS.md: appended Documentation section\n`);
  });

  it('skips everything on a re-run', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], { 'AGENTS.md': '# Agents\n' });
    await runBoth();

    const { shell } = await runBoth();

    expect(shell.stdout).toEqual(
      `Already existed (skipped):\n${listing(PATHS)}` +
      'AGENTS.md: Documentation section already present (skipped)\n'
    );
  });

  it('completes a partially set-up repo', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], {
      'AGENTS.md': '# Agents\n\n## Documentation\n\nCustom\n',
      'docs/agents/plans/.gitkeep': '',
      'docs/agents/flow.md': 'custom flow\n'
    });

    const { shell } = await runBoth();

    expect(shell.stdout).toEqual(
      `Created:\n${listing([PATHS[0], PATHS[2], PATHS[4], PATHS[5]])}` +
      `Already existed (skipped):\n${listing([PATHS[1], PATHS[3]])}` +
      'AGENTS.md: Documentation section already present (skipped)\n'
    );
  });

  it('warns identically when AGENTS.md is missing', async () => {
    const { shell } = await runBoth();

    expect(shell.code).toEqual(0);
    expect(shell.stderr).toEqual('Warning: AGENTS.md not found — skipping Documentation section append.\n');
    expect(shell.stdout).toEqual(`Created:\n${listing(PATHS)}`);
  });
});
