import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'arcanum-check-config', 'scripts', 'check_config.sh');

// Routing spec for the native-only arcanum-check-config command (issue
// #680), run end to end through the real arcanum-check-config/scripts/
// check_config.sh shim and engine_dispatch's --native-only mode. There
// is no shell twin, so there is no shell-vs-native parity spec: this
// spec instead proves the shim reaches core/bin/arcanum in every
// non-docker engine.mode (and that CLAUDE_CONFIG_DIR survives the
// native path's `env -i`), and that engine.mode=docker fails without a
// fallback.
describe('arcanum-check-config native-only routing (via the real check_config.sh shim)', () => {
  let repoPath;
  let homeDir;
  let configDir;
  let env;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-check-config-repo-');
    homeDir = await createTempDir('arcanum-core-check-config-home-');
    configDir = await createTempDir('arcanum-core-check-config-global-');

    await writeFile(
      path.join(configDir, 'arcanum-config.json'),
      JSON.stringify({ git: { authors: ['global@example.com'] } })
    );

    env = { PATH: process.env.PATH, HOME: homeDir, CLAUDE_CONFIG_DIR: configDir };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(homeDir);
    await removeTempDir(configDir);
  });

  /**
   * @param {...string} args - the shim's arguments.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runShim(...args) {
    return runCommand([SHIM_SCRIPT, ...args], repoPath, env);
  }

  [undefined, 'shell', 'native'].forEach((mode) => {
    describe(`with engine.mode ${mode === undefined ? 'unset' : mode}`, () => {
      beforeEach(async () => {
        if (mode !== undefined) {
          await seedEngineMode({ repoPath }, mode);
        }
      });

      it('resolves a global-only key from the forwarded CLAUDE_CONFIG_DIR', async () => {
        const result = await runShim(repoPath, 'git.authors');

        expect(result.code).toEqual(0);
        expect(result.stderr).toEqual('');
        expect(result.stdout).toEqual(`${JSON.stringify({
          key: 'git.authors',
          local: { file: path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), set: false },
          repo: { file: path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), set: false },
          global: { file: path.join(configDir, 'arcanum-config.json'), set: true, value: ['global@example.com'] },
          final: { value: ['global@example.com'], source: 'global' }
        }, null, 2)}\n`);
      });

      it('reports engine.mode from the local tier when seeded there', async () => {
        const result = await runShim(repoPath, 'engine.mode');
        const output = JSON.parse(result.stdout);

        expect(result.code).toEqual(0);

        if (mode === undefined) {
          expect(output.final).toEqual({ value: null, source: null });
        } else {
          expect(output.local).toEqual({
            file: path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), set: true, value: mode
          });
          expect(output.final).toEqual({ value: mode, source: 'local' });
        }
      });
    });
  });

  it('fails without a fallback when engine.mode is docker', async () => {
    await seedEngineMode({ repoPath }, 'docker');

    const result = await runShim(repoPath, 'git.authors');

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain(
      'engine.mode=docker is not implemented yet for native-only command \'arcanum-check-config\''
    );
  });

  it('prints usage on stderr when the key argument is missing', async () => {
    const result = await runShim(repoPath);

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('Usage:');
  });

  it('rejects a malformed key through core/bin/arcanum', async () => {
    const result = await runShim(repoPath, 'git');

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('arcanum: invalid key \'git\': expected <namespace.key[.sub...]>');
  });
});
