import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumCheckConfig from '../../../../lib/commands/arcanum-check-config/ArcanumCheckConfig.js';
import ConfigChain from '../../../../lib/utils/config/ConfigChain.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('ArcanumCheckConfig', () => {
  let repoPath;
  let globalDir;
  let localFile;
  let repoFile;
  let globalFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-core-spec-global-');
    localFile = path.join(repoPath, '.claude', 'state', 'arcanum-config.json');
    repoFile = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
    globalFile = path.join(globalDir, 'arcanum-config.json');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  async function writeJson(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  function newCommand(env = { CLAUDE_CONFIG_DIR: globalDir }) {
    const repoContext = createRepoContextMock({ repoPath });

    return new ArcanumCheckConfig(repoContext, { configChain: new ConfigChain({ env, repoContext }) });
  }

  function render(result) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  describe('#run', () => {
    it('reports a shadowed global tier and resolves from the repo tier', async () => {
      await writeJson(repoFile, { git: { authors: ['repo@x.com'] } });
      await writeJson(globalFile, { git: { authors: ['global@x.com'] } });

      await expectAsync(newCommand().run('git.authors')).toBeResolvedTo(render({
        key: 'git.authors',
        local: { file: localFile, set: false },
        repo: { file: repoFile, set: true, value: ['repo@x.com'] },
        global: { file: globalFile, set: true, value: ['global@x.com'] },
        final: { value: ['repo@x.com'], source: 'repo' }
      }));
    });

    it('resolves from the local tier when only it is set', async () => {
      await writeJson(localFile, { engine: { mode: 'native' } });

      await expectAsync(newCommand().run('engine.mode')).toBeResolvedTo(render({
        key: 'engine.mode',
        local: { file: localFile, set: true, value: 'native' },
        repo: { file: repoFile, set: false },
        global: { file: globalFile, set: false },
        final: { value: 'native', source: 'local' }
      }));
    });

    it('reports a null final value and source when no tier is set', async () => {
      await expectAsync(newCommand().run('engine.mode')).toBeResolvedTo(render({
        key: 'engine.mode',
        local: { file: localFile, set: false },
        repo: { file: repoFile, set: false },
        global: { file: globalFile, set: false },
        final: { value: null, source: null }
      }));
    });

    it('lets an empty string in the local tier win over a set repo tier', async () => {
      await writeJson(localFile, { git: { merge_body_mode: '' } });
      await writeJson(repoFile, { git: { merge_body_mode: 'full' } });

      await expectAsync(newCommand().run('git.merge_body_mode')).toBeResolvedTo(render({
        key: 'git.merge_body_mode',
        local: { file: localFile, set: true, value: '' },
        repo: { file: repoFile, set: true, value: 'full' },
        global: { file: globalFile, set: false },
        final: { value: '', source: 'local' }
      }));
    });

    it('emits object and array values as subtrees and scalars as scalars', async () => {
      await writeJson(localFile, { a: { b: { c: { deep: [1, { e: true }] } } } });
      await writeJson(repoFile, { a: { b: { c: 42 } } });

      await expectAsync(newCommand().run('a.b.c')).toBeResolvedTo(render({
        key: 'a.b.c',
        local: { file: localFile, set: true, value: { deep: [1, { e: true }] } },
        repo: { file: repoFile, set: true, value: 42 },
        global: { file: globalFile, set: false },
        final: { value: { deep: [1, { e: true }] }, source: 'local' }
      }));
    });

    it('reports a null global file when neither HOME nor CLAUDE_CONFIG_DIR is set', async () => {
      await expectAsync(newCommand({}).run('engine.mode')).toBeResolvedTo(render({
        key: 'engine.mode',
        local: { file: localFile, set: false },
        repo: { file: repoFile, set: false },
        global: { file: null, set: false },
        final: { value: null, source: null }
      }));
    });

    it('never emits a value key for an unset tier', async () => {
      const output = JSON.parse(await newCommand().run('engine.mode'));

      expect(Object.keys(output)).toEqual(['key', 'local', 'repo', 'global', 'final']);
      expect(Object.keys(output.local)).toEqual(['file', 'set']);
    });

    it('builds its default ConfigChain from the repo context', async () => {
      await writeJson(localFile, { engine: { mode: 'native' } });

      const command = new ArcanumCheckConfig(createRepoContextMock({ repoPath }));
      const output = JSON.parse(await command.run('engine.mode'));

      expect(output.final).toEqual({ value: 'native', source: 'local' });
    });

    [undefined, ''].forEach((key) => {
      it(`throws the usage error for a ${JSON.stringify(key)} key`, async () => {
        await expectAsync(newCommand().run(key)).toBeRejectedWithError(
          'Usage: /arcanum-check-config <namespace.key[.sub...]>'
        );
      });
    });

    ['git', 'git.', '.x', 'a..b'].forEach((key) => {
      it(`rejects the malformed key '${key}'`, async () => {
        await expectAsync(newCommand().run(key)).toBeRejectedWithError(
          `invalid key '${key}': expected <namespace.key[.sub...]>`
        );
      });
    });
  });
});
