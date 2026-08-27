import SafeFetcher from '../../../../lib/utils/safe/SafeFetcher.js';

describe('SafeFetcher', () => {
  describe('#run', () => {
    it('resolves with fn\'s resolved value on success', async () => {
      const safeFetcher = new SafeFetcher();
      const fn = jasmine.createSpy().and.resolveTo('value');

      await expectAsync(safeFetcher.run(fn)).toBeResolvedTo('value');
    });

    it('returns null when fn synchronously throws', async () => {
      const safeFetcher = new SafeFetcher();
      const fn = jasmine.createSpy().and.callFake(() => {
        throw new Error('boom');
      });

      await expectAsync(safeFetcher.run(fn)).toBeResolvedTo(null);
    });

    it('returns null when fn rejects', async () => {
      const safeFetcher = new SafeFetcher();
      const fn = jasmine.createSpy().and.rejectWith(new Error('boom'));

      await expectAsync(safeFetcher.run(fn)).toBeResolvedTo(null);
    });
  });
});
