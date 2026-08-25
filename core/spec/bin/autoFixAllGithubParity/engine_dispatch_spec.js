import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDispatchFixtures } from '../../support/fixtures/engineDispatchFixtures.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
import { runCommand } from '../../support/utils/runCommand.js';

// Proves arcanum/_lib/engine_dispatch.sh correctly routes based on
// migration-status.json now marking "auto-fix-all-github" migrated
// (node/06's own "Dispatch verification" requirement), using that
// exact single migration-status.json key — unlike every sibling parity
// spec in this directory (matched 1:1 to a `core/bin/arcanum
// auto-fix-all-github-*` COMMANDS entry each), migration-status.json
// tracks this whole 7-subcommand entrypoint under ONE flag
// ("auto-fix-all-github", not 7 separate per-subcommand keys — see
// node/05's "Files to Change"), since `github.sh` hasn't been split
// into a per-entrypoint engine_dispatch shim yet (see node/05's scope
// note, "all changes scoped to core/"). A future shim built against
// that single flag will need to map it to whichever specific
// `core/bin/arcanum` command each subcommand actually dispatches to —
// out of scope here.
//
// This section exercises the real, shared arcanum/_lib/engine_dispatch.sh
// directly via a throwaway wrapper script (built here, not committed)
// plus a throwaway fixture standing in for "the shell implementation"
// — the same role auto-fix-all/scripts/wait_ci_shell.sh plays for
// autoFixAllWaitCiParity_spec.js's own routing section.
//
// This file tests routing, not output parity — it uses `runCommand`/
// `buildDispatchFixtures`/`ENGINE_DISPATCH_SCRIPT` only, never
// `setupParityTest`/`expectParity`.
describe('auto-fix-all-github engine_dispatch routing (via a throwaway shim standing in for github.sh)', () => {
  const COMMAND = 'auto-fix-all-github';

  /**
   * @param {string} repoDir - the (plain, non-git) directory
   *   `engine_dispatch` resolves `engine.mode` against.
   * @param {string} mode - `"shell"` or `"native"`.
   * @returns {Promise<void>} resolves once written.
   */
  async function seedEngineMode(repoDir, mode) {
    const dir = path.join(repoDir, '.claude', 'state');

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode } }));
  }

  it('routes to the shell fixture when engine.mode=shell', async () => {
    const dir = await createTempDir('arcanum-core-afag-dispatch-');

    try {
      const { wrapperPath, fixturePath } = await buildDispatchFixtures(dir);
      const repoDir = path.join(dir, 'repo');

      await mkdir(repoDir, { recursive: true });
      await seedEngineMode(repoDir, 'shell');

      const result = await runCommand(['bash', wrapperPath, repoDir, COMMAND, fixturePath, repoDir]);

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(`SHELL: ${repoDir}\n`);
    } finally {
      await removeTempDir(dir);
    }
  });

  it('routes to core/bin/arcanum when engine.mode=native, given migration-status.json\'s true flag', async () => {
    const dir = await createTempDir('arcanum-core-afag-dispatch-');

    try {
      const { wrapperPath, fixturePath } = await buildDispatchFixtures(dir);
      const repoDir = path.join(dir, 'repo');

      await mkdir(repoDir, { recursive: true });
      await seedEngineMode(repoDir, 'native');

      const result = await runCommand(['bash', wrapperPath, repoDir, COMMAND, fixturePath, repoDir]);

      expect(result.stdout).not.toEqual(`SHELL: ${repoDir}\n`);
      expect(result.stdout).toEqual('');
      expect(result.code).not.toEqual(0);
      expect(result.stderr).not.toContain('no native implementation');
      expect(result.stderr).toContain('unknown command');
    } finally {
      await removeTempDir(dir);
    }
  });
});
