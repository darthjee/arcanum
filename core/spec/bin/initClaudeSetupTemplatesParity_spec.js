import {
  createParityDirs,
  expectInitClaudeParity,
  runInitClaudeBoth,
  seedFiles
} from '../support/utils/initClaudeParity.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "init-claude-setup-templates" migrated entrypoint
// (issue #592) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// init-claude/scripts/setup_templates_shell.sh (directly, NOT through the
// engine_dispatch shim) and `core/bin/arcanum init-claude-setup-templates`
// against equivalent project dirs, asserting identical stdout/stderr/exit
// code and byte-identical files.

const NAMES = ['pull_request_template.md', 'commit_message_template.md', 'commit_message_template-2.0.md'];

describe('init-claude-setup-templates parity (shell vs. native)', () => {
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
      script: 'setup_templates',
      command: 'init-claude-setup-templates',
      ...dirs
    });

    await expectInitClaudeParity(results, dirs);

    return results;
  }

  it('creates every template in an empty project', async () => {
    const { shell } = await runBoth();

    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual(`Created: ${NAMES.join(' ')}\n`);
  });

  it('leaves every template untouched when all are present', async () => {
    await seedFiles(
      [dirs.shellDir, dirs.nativeDir],
      Object.fromEntries(NAMES.map((name) => [`.github/${name}`, `custom ${name}`]))
    );

    const { shell } = await runBoth();

    expect(shell.stdout).toEqual(`Already present, left untouched: ${NAMES.join(' ')}\n`);
  });

  it('creates the missing templates and skips the present ones', async () => {
    await seedFiles([dirs.shellDir, dirs.nativeDir], { '.github/commit_message_template.md': 'custom' });

    const { shell } = await runBoth();

    expect(shell.stdout).toEqual(
      'Created: pull_request_template.md commit_message_template-2.0.md\n' +
      'Already present, left untouched: commit_message_template.md\n'
    );
  });
});
