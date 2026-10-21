import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CLI_DIR, REPO_ROOT } from '../support/paths.js';

/**
 * @param {string} file - a JSON file path.
 * @returns {Promise<object>} its parsed content.
 */
async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

describe('lockstep', () => {
  let cliManifest;

  beforeAll(async () => {
    cliManifest = await readJson(path.join(CLI_DIR, 'package.json'));
  });

  it('keeps the CLI version equal to arcanum.version', async () => {
    const arcanumVersion = (await readFile(path.join(REPO_ROOT, 'arcanum.version'), 'utf8')).trim();

    expect(cliManifest.version).toBe(arcanumVersion);
  });

  it('keeps engines.node equal to core/package.json\'s', async () => {
    const coreManifest = await readJson(path.join(REPO_ROOT, 'core', 'package.json'));

    expect(cliManifest.engines.node).toBe(coreManifest.engines.node);
  });

  it('keeps the floor literal in bin/arcanum equal to engines.node', async () => {
    const gate = await readFile(path.join(CLI_DIR, 'bin', 'arcanum'), 'utf8');
    const match = /const NODE_FLOOR = '([^']+)';/.exec(gate);

    expect(match).withContext('NODE_FLOOR literal in bin/arcanum').not.toBeNull();
    expect(`>=${match[1]}`).toBe(cliManifest.engines.node);
  });
});
