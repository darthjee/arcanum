import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'init-claude', 'scripts', 'set_next_step_auto.sh');

// Routing spec for the native-only init-claude-set-next-step-auto
// command (issue #716), run end to end through the real
// init-claude/scripts/set_next_step_auto.sh shim and engine_dispatch's
// --native-only mode. There is no shell twin, so there is no
// shell-vs-native parity spec: this spec instead proves the shim reaches
// core/bin/arcanum in every non-docker engine.mode, and that
// engine.mode=docker fails without a fallback.
describe('init-claude-set-next-step-auto native-only routing (via the real set_next_step_auto.sh shim)', () => {
  let repoPath;
  let configFile;
  let env;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-next-step-auto-repo-');
    configFile = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
    env = { PATH: process.env.PATH, HOME: repoPath };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {...string} args - the shim's arguments.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runShim(...args) {
    return runCommand([SHIM_SCRIPT, ...args], repoPath, env);
  }

  /**
   * @returns {Promise<object>} the parsed repo config.
   */
  async function writtenConfig() {
    return JSON.parse(await readFile(configFile, 'utf8'));
  }

  [undefined, 'shell', 'native'].forEach((mode) => {
    describe(`with engine.mode ${mode === undefined ? 'unset' : mode}`, () => {
      beforeEach(async () => {
        if (mode !== undefined) {
          await seedEngineMode({ repoPath }, mode);
        }
      });

      it('writes next_step.auto.<skill> and prints NEXT_STEP_AUTO=', async () => {
        const first = await runShim(repoPath, 'enhance-issue', 'true');
        const second = await runShim(repoPath, 'discuss-issue', 'false');

        expect(first).toEqual({ stdout: 'NEXT_STEP_AUTO=enhance-issue=true\n', stderr: '', code: 0 });
        expect(second).toEqual({ stdout: 'NEXT_STEP_AUTO=discuss-issue=false\n', stderr: '', code: 0 });
        expect(await writtenConfig()).toEqual({
          next_step: { auto: { 'enhance-issue': true, 'discuss-issue': false } }
        });
      });

      it('rejects an unknown skill through core/bin/arcanum', async () => {
        const result = await runShim(repoPath, 'nope', 'true');

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('arcanum: unknown skill \'nope\'');
      });

      it('rejects a bad value through core/bin/arcanum', async () => {
        const result = await runShim(repoPath, 'auto-plan-issue', 'yes');

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('arcanum: invalid value \'yes\': expected true or false');
      });
    });
  });

  it('fails without a fallback when engine.mode is docker', async () => {
    await seedEngineMode({ repoPath }, 'docker');

    const result = await runShim(repoPath, 'enhance-issue', 'true');

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain(
      'engine.mode=docker is not implemented yet for native-only command \'init-claude-set-next-step-auto\''
    );
  });

  [[], ['REPO'], ['REPO', 'enhance-issue']].forEach((args) => {
    it(`prints usage on stderr before dispatch for ${args.length} argument(s)`, async () => {
      const result = await runShim(...args.map((arg) => (arg === 'REPO' ? repoPath : arg)));

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain('Usage:');
    });
  });
});
