import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoConfig from '../../../../lib/utils/config/RepoConfig.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('RepoConfig', () => {
  let repoPath;
  let repoConfig;

  beforeEach(async () => {
    repoPath = await createTempDir();
    repoConfig = new RepoConfig(createRepoContextMock({ repoPath }));
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#getSafeBranch', () => {
    it('defaults to origin/main when the config file is absent', async () => {
      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });

    it('reads git.safe_branch from .claude/state/arcanum-config.json when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ git: { safe_branch: 'origin/develop' } })
      );

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/develop');
    });

    it('defaults to origin/main when the key is absent from the config file', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), JSON.stringify({}));

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });

    it('defaults to origin/main when the config file is malformed JSON', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), '{not valid json');

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });
  });

  describe('#getIgnoredCheckPatterns', () => {
    it('defaults to [] when the config file is absent', async () => {
      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('reads auto-fix-all.ignored_check_patterns from .claude/configuration/arcanum-repo-config.json when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
        JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: ['codacy', 'dependabot'] } })
      );

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo(['codacy', 'dependabot']);
    });

    it('defaults to [] when the auto-fix-all namespace is absent', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), JSON.stringify({}));

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('defaults to [] when ignored_check_patterns is absent from the auto-fix-all namespace', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
        JSON.stringify({ 'auto-fix-all': {} })
      );

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('defaults to [] when ignored_check_patterns is not itself an array', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
        JSON.stringify({ 'auto-fix-all': { ignored_check_patterns: 'not-an-array' } })
      );

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('defaults to [] when the config file is malformed JSON', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), '{not valid json');

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('does not fall back to the legacy .claude/configuration/auto-fix-all.json file', async () => {
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'configuration', 'auto-fix-all.json'),
        JSON.stringify({ ignored_check_patterns: ['codacy'] })
      );

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });
  });
});
