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

  it('rejects a core/lib import outside the surface entry files', async () => {
    expect((await boundaryMessages('../../../core/lib/context/RepoContext.js')).length).toBe(1);
    expect((await boundaryMessages('../../../core/lib/utils/config/BooleanKeyConfig.js')).length).toBe(1);
  });

  it('accepts the surface entry files', async () => {
    for (const file of [
      'config/ConfigChain', 'config/RepoConfigWriter', 'config/ConfigError', 'config/AgentEmail',
      'config/KeyRegistry', 'file/Lock', 'file/RepoPath'
    ]) {
      expect(await boundaryMessages(`../../../core/lib/utils/${file}.js`)).withContext(file).toEqual([]);
    }
  });

  it('accepts imports outside core/lib', async () => {
    expect(await boundaryMessages('../exitCodes.js')).toEqual([]);
    expect(await boundaryMessages('node:path')).toEqual([]);
  });
});
