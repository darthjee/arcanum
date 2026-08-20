import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoConfig from '../../lib/RepoConfig.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('RepoConfig', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#getSafeBranch', () => {
    it('defaults to origin/main when the config file is absent', async () => {
      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });

    it('reads git.safe_branch from .claude/state/arcanum-config.json when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ git: { safe_branch: 'origin/develop' } })
      );

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/develop');
    });

    it('defaults to origin/main when the key is absent from the config file', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), JSON.stringify({}));

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });

    it('defaults to origin/main when the config file is malformed JSON', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), '{not valid json');

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });
  });
});
