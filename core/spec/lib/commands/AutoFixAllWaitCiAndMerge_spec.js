import AutoFixAllWaitCiAndMerge from '../../../lib/commands/AutoFixAllWaitCiAndMerge.js';

const REPO_PATH = '/repo/path';
const MODEL_EMAIL = 'model@example.com';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for AutoFixAllWaitCiAndMerge.
 */
function stubDeps(overrides = {}) {
  return {
    waitCi: { run: jasmine.createSpy('waitCi.run').and.resolveTo('passed\n') },
    github: { prMerge: jasmine.createSpy('github.prMerge').and.resolveTo('https://github.com/darthjee/arcanum/pull/7\n') },
    ...overrides
  };
}

describe('AutoFixAllWaitCiAndMerge', () => {
  describe('#run', () => {
    it('throws the usage message when repo_path is missing', async () => {
      const deps = stubDeps();
      const instance = new AutoFixAllWaitCiAndMerge({ repoPath: '' }, deps);

      await expectAsync(instance.run(MODEL_EMAIL)).toBeRejectedWithError(
        'Usage: wait_ci_and_merge.sh <repo_path> [model_email]'
      );
      expect(deps.waitCi.run).not.toHaveBeenCalled();
      expect(deps.github.prMerge).not.toHaveBeenCalled();
    });

    describe('when CI passed', () => {
      it('merges the pull request and resolves "passed\\n<url>\\n"', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllWaitCiAndMerge({ repoPath: REPO_PATH }, deps);

        await expectAsync(instance.run(MODEL_EMAIL)).toBeResolvedTo(
          'passed\nhttps://github.com/darthjee/arcanum/pull/7\n'
        );
        expect(deps.waitCi.run).toHaveBeenCalledWith();
        expect(deps.github.prMerge).toHaveBeenCalledWith(MODEL_EMAIL);
      });

      it('forwards an omitted modelEmail as undefined', async () => {
        const deps = stubDeps();
        const instance = new AutoFixAllWaitCiAndMerge({ repoPath: REPO_PATH }, deps);

        await instance.run();

        expect(deps.github.prMerge).toHaveBeenCalledWith(undefined);
      });

      it('propagates an error thrown by the merge call', async () => {
        const deps = stubDeps({
          github: { prMerge: jasmine.createSpy('github.prMerge').and.rejectWith(new Error('Error: could not merge PR #7 on darthjee/arcanum')) }
        });
        const instance = new AutoFixAllWaitCiAndMerge({ repoPath: REPO_PATH }, deps);

        await expectAsync(instance.run(MODEL_EMAIL)).toBeRejectedWithError(
          'Error: could not merge PR #7 on darthjee/arcanum'
        );
      });
    });

    describe('when CI failed', () => {
      it('resolves the untouched failed output and never attempts a merge', async () => {
        const deps = stubDeps({
          waitCi: { run: jasmine.createSpy('waitCi.run').and.resolveTo('failed\nbuild\n') }
        });
        const instance = new AutoFixAllWaitCiAndMerge({ repoPath: REPO_PATH }, deps);

        await expectAsync(instance.run(MODEL_EMAIL)).toBeResolvedTo('failed\nbuild\n');
        expect(deps.github.prMerge).not.toHaveBeenCalled();
      });
    });

    describe('when the CI wait itself throws', () => {
      it('propagates the error and never attempts a merge', async () => {
        const deps = stubDeps({
          waitCi: { run: jasmine.createSpy('waitCi.run').and.rejectWith(new Error('Error: no pull request found for the current branch on darthjee/arcanum')) }
        });
        const instance = new AutoFixAllWaitCiAndMerge({ repoPath: REPO_PATH }, deps);

        await expectAsync(instance.run(MODEL_EMAIL)).toBeRejectedWithError(
          'Error: no pull request found for the current branch on darthjee/arcanum'
        );
        expect(deps.github.prMerge).not.toHaveBeenCalled();
      });
    });
  });
});
