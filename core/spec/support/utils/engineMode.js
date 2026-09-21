import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Seeds `.claude/state/arcanum-config.json`'s `engine.mode` under
 * `repo.repoPath`, the local-state (highest-precedence) tier
 * `config_chain_read`/`engine_dispatch.sh` consult.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - `"shell"` or `"native"`.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedEngineMode(repo, mode) {
  const dir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify({ engine: { mode } }));
}
