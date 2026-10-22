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

  it('rejects a core/ import outside core/lib/shared/', async () => {
    for (const specifier of [
      '../../../core/lib/context/RepoContext.js',
      '../../../core/lib/utils/config/BooleanKeyConfig.js',
      '../../../core/lib/utils/config/ConfigChain.js',
      '../../../core/package.json'
    ]) {
      expect((await boundaryMessages(specifier)).length).withContext(specifier).toBe(1);
    }
  });

  it('accepts any file under core/lib/shared/', async () => {
    for (const file of [
      'config/ConfigChain', 'config/RepoConfigWriter', 'config/ConfigError', 'config/AgentEmail',
      'config/KeyRegistry', 'config/RepoConfig', 'file/Lock', 'file/LockTimeoutError', 'file/RepoPath'
    ]) {
      expect(await boundaryMessages(`../../../core/lib/shared/${file}.js`)).withContext(file).toEqual([]);
    }
  });

  it('accepts imports outside core/lib', async () => {
    expect(await boundaryMessages('../exitCodes.js')).toEqual([]);
    expect(await boundaryMessages('node:path')).toEqual([]);
  });
});
