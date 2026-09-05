import Dispatcher from '../../../lib/core/dispatcher.js';

describe('Dispatcher (context getters)', () => {
  describe('repoContext getter', () => {
    it('is lazy — not built until first read', () => {
      const dispatcher = new Dispatcher('spawn-issue', ['/fake/repo']);

      expect(dispatcher._repoContext).toBeUndefined();
    });

    it('is memoized — repeated reads return the same instance', () => {
      const dispatcher = new Dispatcher('spawn-issue', ['/fake/repo']);

      expect(dispatcher.repoContext).toBe(dispatcher.repoContext);
    });
  });

  describe('claudeContext getter', () => {
    it('is lazy — not built until first read', () => {
      const dispatcher = new Dispatcher('permission-grant-add', ['/fake/anchor']);

      expect(dispatcher._claudeContext).toBeUndefined();
    });

    it('is memoized — repeated reads return the same instance', () => {
      const dispatcher = new Dispatcher('permission-grant-add', ['/fake/anchor']);

      expect(dispatcher.claudeContext).toBe(dispatcher.claudeContext);
    });
  });
});
