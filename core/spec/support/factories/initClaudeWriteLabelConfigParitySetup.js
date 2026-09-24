import path from 'node:path';
import {
  createParityDirs,
  expectInitClaudeParity,
  runInitClaudeBoth,
  seedFiles
} from '../utils/initClaudeParity.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

/** The label-config path, relative to each side's project dir. */
export const CONFIG = path.join('.claude', 'state', 'init-claude-config.json');

/**
 * Build the per-spec parity harness for one `write_label_config_<sub>`
 * subcommand: fresh `shell/`/`native/`/`cwd/` dirs per spec, plus a
 * `run(items, seed)` that seeds both project dirs, runs
 * `write_label_config_<sub>_shell.sh <abs_config> <items...>` and
 * `core/bin/arcanum init-claude-write-label-config-<sub> <nativeDir>
 * <abs_config> <items...>` (each side's config under its own dir, as
 * the shim would pass it), and asserts identical stdout/stderr/exit
 * code and byte-identical trees.
 * @param {'replace'|'remove'|'add'} sub - the subcommand.
 * @returns {{run: (items: string[], seed?: {[key: string]: string}) => Promise<{results: object, tree: object}>}}
 *   the harness (valid inside the calling `describe`).
 */
export function writeLabelConfigParityHarness(sub) {
  const harness = {};
  let baseDir;

  beforeEach(async () => {
    baseDir = await createTempDir();
    harness.dirs = await createParityDirs(baseDir);
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  harness.run = async (items, seed = undefined) => {
    const { dirs } = harness;

    if (seed !== undefined) {
      await seedFiles([dirs.shellDir, dirs.nativeDir], { [CONFIG]: seed });
    }

    const results = await runInitClaudeBoth({
      script: `write_label_config_${sub}`,
      command: `init-claude-write-label-config-${sub}`,
      shellArgs: [path.join(dirs.shellDir, CONFIG), ...items],
      nativeArgs: [path.join(dirs.nativeDir, CONFIG), ...items],
      ...dirs
    });
    const tree = await expectInitClaudeParity(results, dirs);

    return { results, tree };
  };

  return harness;
}
