import { ESLint } from 'eslint';
import path from 'node:path';
import { CLI_DIR } from '../support/paths.js';

const RULE = 'no-restricted-imports';

describe('cli/eslint.config.mjs shared-surface boundary', () => {
  let eslint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: CLI_DIR });
  });

  /**
   * @param {string} specifier - the import specifier to lint.
   * @returns {Promise<object[]>} the boundary rule's messages.
   */
  async function boundaryMessages(specifier) {
    const [result] = await eslint.lintText(
      `import thing from '${specifier}';\n\nexport default thing;\n`,
      { filePath: path.join(CLI_DIR, 'lib', 'commands', 'fake.js') }
    );

    return result.messages.filter((message) => message.ruleId === RULE);
  }

  it('rejects any core/ import', async () => {
    for (const specifier of [
      '../../../core/lib/context/RepoContext.js',
      '../../../core/lib/utils/config/BooleanKeyConfig.js',
      '../../../core/lib/utils/config/ConfigChain.js',
      '../../../core/lib/shared/config/KeyRegistry.js',
      '../../../core/package.json'
    ]) {
      expect((await boundaryMessages(specifier)).length).withContext(specifier).toBe(1);
    }
  });

  it('accepts any file under shared/lib/', async () => {
    for (const file of [
      'config/ConfigChain.js', 'config/RepoConfigWriter.js', 'config/ConfigError.js', 'config/AgentEmail.js',
      'config/KeyRegistry.js', 'config/RepoConfig.js', 'config/keys.json',
      'file/Lock.js', 'file/LockTimeoutError.js', 'file/RepoPath.js'
    ]) {
      expect(await boundaryMessages(`../../../shared/lib/${file}`)).withContext(file).toEqual([]);
    }
  });

  it('rejects a shared/spec/ import', async () => {
    for (const specifier of [
      '../../../shared/spec/support/helpers.js',
      '../../../shared/spec/lib/config/KeyRegistry_spec.js'
    ]) {
      expect((await boundaryMessages(specifier)).length).withContext(specifier).toBe(1);
    }
  });

  it('accepts imports outside core/ and shared/spec/', async () => {
    expect(await boundaryMessages('../exitCodes.js')).toEqual([]);
    expect(await boundaryMessages('node:path')).toEqual([]);
  });
});
