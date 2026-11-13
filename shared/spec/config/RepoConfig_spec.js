import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoConfig from '../../lib/config/RepoConfig.js';
import { createRepoContextMock } from '../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('RepoConfig', () => {
  let repoPath;
  let globalDir;
  let repoConfig;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-shared-spec-global-');
    repoConfig = new RepoConfig(createRepoContextMock({ repoPath }), { env: { CLAUDE_CONFIG_DIR: globalDir } });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  async function writeJson(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  const localFile = () => path.join(repoPath, '.claude', 'state', 'arcanum-config.json');
  const repoFile = () => path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
  const globalFile = () => path.join(globalDir, 'arcanum-config.json');

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

    it('defaults to origin/main when git.safe_branch is an empty string', async () => {
      await writeJson(localFile(), { git: { safe_branch: '' } });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });

    it('ignores git.safe_branch set only in the repo config, a tier keys.json does not allow', async () => {
      await writeJson(repoFile(), { git: { safe_branch: 'origin/repo' } });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });

    it('reads git.safe_branch from the global config when the local config does not set it', async () => {
      await writeJson(globalFile(), { git: { safe_branch: 'origin/global' } });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/global');
    });

    it('prefers the local value over the global one', async () => {
      await writeJson(localFile(), { git: { safe_branch: 'origin/local' } });
      await writeJson(globalFile(), { git: { safe_branch: 'origin/global' } });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/local');
    });

    it('prefers the local value over the repo and global ones', async () => {
      await writeJson(localFile(), { git: { safe_branch: 'origin/local' } });
      await writeJson(repoFile(), { git: { safe_branch: 'origin/repo' } });
      await writeJson(globalFile(), { git: { safe_branch: 'origin/global' } });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/local');
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

    it('reads ignored_check_patterns from the local config when only it sets them', async () => {
      await writeJson(localFile(), { 'auto-fix-all': { ignored_check_patterns: ['local'] } });

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo(['local']);
    });

    it('lets the local value override the repo one', async () => {
      await writeJson(localFile(), { 'auto-fix-all': { ignored_check_patterns: ['local'] } });
      await writeJson(repoFile(), { 'auto-fix-all': { ignored_check_patterns: ['repo'] } });

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo(['local']);
    });

    it('ignores ignored_check_patterns set only in the global config, a tier keys.json does not allow', async () => {
      await writeJson(globalFile(), { 'auto-fix-all': { ignored_check_patterns: ['global'] } });

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });

    it('reads the repo value over the global one when the local config does not set it', async () => {
      await writeJson(repoFile(), { 'auto-fix-all': { ignored_check_patterns: ['repo'] } });
      await writeJson(globalFile(), { 'auto-fix-all': { ignored_check_patterns: ['global'] } });

      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo(['repo']);
    });
  });

  describe('with an injected ConfigChain', () => {
    it('reads both keys through it', async () => {
      const configChain = jasmine.createSpyObj('ConfigChain', ['read']);

      configChain.read.and.callFake(async (_repoPath, namespace) => (namespace === 'git' ? 'origin/x' : ['p']));
      repoConfig = new RepoConfig(createRepoContextMock({ repoPath }), { configChain });

      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/x');
      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo(['p']);
      expect(configChain.read.calls.allArgs()).toEqual([
        [repoPath, 'git', 'safe_branch'],
        [repoPath, 'auto-fix-all', 'ignored_check_patterns']
      ]);
    });
  });

  describe('with the strict-keys guard', () => {
    beforeEach(() => {
      repoConfig = new RepoConfig(createRepoContextMock({ repoPath }), {
        env: { ARCANUM_STRICT_CONFIG_KEYS: '1', CLAUDE_CONFIG_DIR: globalDir }
      });
    });

    it('reads git.safe_branch, a registered key', async () => {
      await expectAsync(repoConfig.getSafeBranch()).toBeResolvedTo('origin/main');
    });

    it('reads auto-fix-all.ignored_check_patterns, a registered key', async () => {
      await expectAsync(repoConfig.getIgnoredCheckPatterns()).toBeResolvedTo([]);
    });
  });
});
