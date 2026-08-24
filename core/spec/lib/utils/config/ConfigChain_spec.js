import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ConfigChain from '../../../../lib/utils/config/ConfigChain.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('ConfigChain', () => {
  let repoPath;
  let globalDir;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-core-spec-global-');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  function newConfigChain(env = {}) {
    return new ConfigChain({ env: { CLAUDE_CONFIG_DIR: globalDir, ...env } });
  }

  async function writeLocalState(content) {
    const dir = path.join(repoPath, '.claude', 'state');

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify(content));
  }

  async function writeRepoConfig(content) {
    const dir = path.join(repoPath, '.claude', 'configuration');

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'arcanum-repo-config.json'), JSON.stringify(content));
  }

  async function writeGlobalConfig(content) {
    await mkdir(globalDir, { recursive: true });
    await writeFile(path.join(globalDir, 'arcanum-config.json'), JSON.stringify(content));
  }

  describe('#read', () => {
    it('returns undefined when every tier is absent', async () => {
      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo(undefined);
    });

    it('resolves from local state first, ahead of repo config and global config', async () => {
      await writeLocalState({ git: { merge_body_mode: 'coauthors' } });
      await writeRepoConfig({ git: { merge_body_mode: 'full' } });
      await writeGlobalConfig({ git: { merge_body_mode: 'empty' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('coauthors');
    });

    it('falls back to repo config when local state is absent', async () => {
      await writeRepoConfig({ git: { merge_body_mode: 'full' } });
      await writeGlobalConfig({ git: { merge_body_mode: 'empty' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('full');
    });

    it('falls back to global config when local state and repo config are both absent', async () => {
      await writeGlobalConfig({ git: { merge_body_mode: 'empty' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('empty');
    });

    it('fully resolves every given key within a tier before advancing to the next tier', async () => {
      // Local state has a value under the generic key ("email"), repo
      // config has a value under the specific key ("agents.architect").
      // Since local state is fully resolved first (both keys tried
      // there), the generic local-state value wins even though repo
      // config has a more specific match.
      await writeLocalState({ git: { email: 'generic@local' } });
      await writeRepoConfig({ git: { agents: { architect: 'specific@repo' } } });

      const configChain = newConfigChain();

      await expectAsync(
        configChain.read(repoPath, 'git', 'agents.architect', 'email')
      ).toBeResolvedTo('generic@local');
    });

    it('tries keys in the given order within a tier', async () => {
      await writeLocalState({ git: { agents: { architect: 'specific@local' }, email: 'generic@local' } });

      const configChain = newConfigChain();

      await expectAsync(
        configChain.read(repoPath, 'git', 'agents.architect', 'email')
      ).toBeResolvedTo('specific@local');
    });

    it('resolves a dot-separated nested key path', async () => {
      await writeLocalState({ git: { agents: { architect: 'architect@local' } } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'agents.architect')).toBeResolvedTo('architect@local');
    });

    it('treats a JSON null value the same as absent, falling through to the next tier', async () => {
      await writeLocalState({ git: { merge_body_mode: null } });
      await writeRepoConfig({ git: { merge_body_mode: 'full' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('full');
    });

    it('treats a JSON null value the same as absent, falling through to the next key within the same tier', async () => {
      await writeLocalState({ git: { agents: { architect: null }, email: 'generic@local' } });

      const configChain = newConfigChain();

      await expectAsync(
        configChain.read(repoPath, 'git', 'agents.architect', 'email')
      ).toBeResolvedTo('generic@local');
    });

    it('treats an explicit empty string as a real value, stopping the chain there', async () => {
      await writeLocalState({ git: { merge_body_mode: '' } });
      await writeRepoConfig({ git: { merge_body_mode: 'full' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('');
    });

    it('resolves a non-string value (e.g. a boolean/array) unchanged', async () => {
      await writeLocalState({ git: { omit_model_coauthor: true, remove_coauthors: ['a@x.com'] } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'omit_model_coauthor')).toBeResolvedTo(true);
      await expectAsync(configChain.read(repoPath, 'git', 'remove_coauthors')).toBeResolvedTo(['a@x.com']);
    });

    it('fails open (falls through) on a missing global config location', async () => {
      await writeLocalState({});

      const configChain = new ConfigChain({ env: {} });

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo(undefined);
    });

    it('fails open (falls through) on malformed JSON at any tier', async () => {
      const dir = path.join(repoPath, '.claude', 'state');

      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'arcanum-config.json'), '{not valid json');
      await writeRepoConfig({ git: { merge_body_mode: 'full' } });

      const configChain = newConfigChain();

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('full');
    });

    it('falls back to $HOME/.claude when CLAUDE_CONFIG_DIR is unset', async () => {
      await mkdir(path.join(globalDir, '.claude'), { recursive: true });
      await writeFile(
        path.join(globalDir, '.claude', 'arcanum-config.json'),
        JSON.stringify({ git: { merge_body_mode: 'coauthors' } })
      );

      const configChain = new ConfigChain({ env: { HOME: globalDir } });

      await expectAsync(configChain.read(repoPath, 'git', 'merge_body_mode')).toBeResolvedTo('coauthors');
    });
  });
});
