import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('shared/eslint.config.mjs import boundary', () => {
  let eslint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: SHARED_DIR });
  });

  /**
   * @param {string} source - the source text to lint.
   * @param {string} file - the file path, relative to `shared/`.
   * @param {string} ruleId - the rule whose messages to keep.
   * @returns {Promise<object[]>} the rule's messages.
   */
  async function messages(source, file, ruleId) {
    const [result] = await eslint.lintText(source, { filePath: path.join(SHARED_DIR, file) });

    return result.messages.filter((message) => message.ruleId === ruleId);
  }

  /**
   * @param {string} specifier - the import specifier to lint.
   * @param {string} [file] - the file path, relative to `shared/`.
   * @returns {Promise<object[]>} the boundary rule's messages.
   */
  function boundaryMessages(specifier, file = 'lib/config/fake.js') {
    return messages(
      `import thing from '${specifier}';\n\nexport default thing;\n`,
      file,
      'no-restricted-imports'
    );
  }

  it('accepts node: built-ins and files under shared/lib/', async () => {
    for (const specifier of [
      'node:fs/promises',
      'node:path',
      './ConfigError.js',
      '../file/Lock.js',
      './keys.json'
    ]) {
      expect(await boundaryMessages(specifier)).withContext(specifier).toEqual([]);
    }
  });

  it('rejects bare built-ins, paths outside shared/lib/ and packages', async () => {
    for (const specifier of [
      'fs',
      'path',
      '../../../core/lib/context/RepoContext.js',
      '../../spec/support/utils/tempDir.js',
      '../../package.json',
      'eslint'
    ]) {
      expect((await boundaryMessages(specifier)).length).withContext(specifier).toBe(1);
    }
  });

  it('rejects a dynamic import()', async () => {
    const found = await messages(
      'export default async function load() {\n  return import(\'node:fs\');\n}\n',
      'lib/config/fake.js',
      'no-restricted-syntax'
    );

    expect(found.length).toBe(1);
  });

  it('does not apply to files under spec/', async () => {
    expect(await boundaryMessages('../../lib/config/ConfigChain.js', 'spec/config/fake_spec.js')).toEqual([]);
  });
});
