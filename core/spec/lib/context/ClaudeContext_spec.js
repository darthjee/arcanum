import ClaudeContext from '../../../lib/context/ClaudeContext.js';

const REPO_PATH = '/fake/repo';

describe('ClaudeContext', () => {
  function newContext(overrides = {}) {
    return new ClaudeContext({
      repoPath: REPO_PATH,
      env: {},
      ...overrides
    });
  }

  describe('#resolve', () => {
    it('returns an absolute path unchanged', () => {
      const context = newContext();

      expect(context.resolve('/etc/settings.json')).toEqual('/etc/settings.json');
    });

    it('resolves a relative path against repoPath, not process.cwd()', () => {
      const context = newContext();

      expect(context.resolve('.claude/settings.json')).toEqual('/fake/repo/.claude/settings.json');
    });
  });

  describe('#localSettingsPath', () => {
    it('points at .claude/settings.local.json under repoPath', () => {
      const context = newContext();

      expect(context.localSettingsPath()).toEqual('/fake/repo/.claude/settings.local.json');
    });
  });

  describe('#projectSettingsPath', () => {
    it('points at .claude/settings.json under repoPath', () => {
      const context = newContext();

      expect(context.projectSettingsPath()).toEqual('/fake/repo/.claude/settings.json');
    });
  });

  describe('#globalSettingsPath', () => {
    it('uses CLAUDE_CONFIG_DIR when set', () => {
      const context = newContext({ env: { CLAUDE_CONFIG_DIR: '/custom/claude', HOME: '/home/me' } });

      expect(context.globalSettingsPath()).toEqual('/custom/claude/settings.json');
    });

    it('falls back to $HOME/.claude when CLAUDE_CONFIG_DIR is unset', () => {
      const context = newContext({ env: { HOME: '/home/me' } });

      expect(context.globalSettingsPath()).toEqual('/home/me/.claude/settings.json');
    });
  });

  describe('defaults', () => {
    it('stores repoPath', () => {
      const context = new ClaudeContext({ repoPath: REPO_PATH });

      expect(context.repoPath).toEqual(REPO_PATH);
    });
  });
});
