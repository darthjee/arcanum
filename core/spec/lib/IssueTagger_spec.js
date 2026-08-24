import DispatchFailure from '../../lib/DispatchFailure.js';
import IssueTagger from '../../lib/IssueTagger.js';
import { fakeFetch } from '../support/utils/fakeFetch.js';
import { captureStdout } from '../support/utils/captureStdout.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';

describe('IssueTagger', () => {
  function newTagger(overrides = {}) {
    return new IssueTagger({
      origin: { resolve: async () => ({ domain: 'github.com', repo: REPO }) },
      githubToken: { get: async () => TOKEN },
      fetchFn: fakeFetch(),
      ...overrides
    });
  }

  describe('#markEnqueued', () => {
    it('best-effort attempts the label mutation for every given id', async () => {
      const fetchFn = fakeFetch();
      const tagger = newTagger({ fetchFn });

      await captureStdout(() => tagger.markEnqueued('/repo', ['10', '20']));

      // 3 GET calls per id (enqueued/ready_for_work/created), 1 POST
      // (add enqueued, not yet present) and 2 DELETE (remove
      // ready_for_work/created, both present) per id.
      const urls = fetchFn.calls.allArgs().map(([url]) => url);

      expect(urls.filter((url) => url === 'https://api.github.com/repos/darthjee/arcanum/issues/10').length).toEqual(3);
      expect(urls.filter((url) => url === 'https://api.github.com/repos/darthjee/arcanum/issues/20').length).toEqual(3);

      const methods = fetchFn.calls.allArgs().map(([, options]) => options.method);

      expect(methods.filter((method) => method === 'POST').length).toEqual(2);
      expect(methods.filter((method) => method === 'DELETE').length).toEqual(4);
    });

    it('warns to stderr, without stopping, when a label mutation fails', async () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger({ fetchFn: fakeFetch({ getFails: true }) });

      await captureStdout(() => tagger.markEnqueued('/repo', ['10']));

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'ready_for_work\' tag from issue #10 on darthjee/arcanum\n'
      );
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'created\' tag from issue #10 on darthjee/arcanum\n'
      );
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1) when resolving the origin fails', async () => {
      const tagger = newTagger({ origin: { resolve: async () => { throw new Error('no origin'); } } });
      let thrown;

      try {
        await tagger.markEnqueued('/repo', ['10']);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1) when resolving the github token fails', async () => {
      const tagger = newTagger({ githubToken: { get: async () => { throw new Error('no token'); } } });
      let thrown;

      try {
        await tagger.markEnqueued('/repo', ['10']);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('domain-qualifies the repo ref for a non-github.com origin', async () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger({
        origin: { resolve: async () => ({ domain: 'example.com', repo: REPO }) },
        fetchFn: fakeFetch({ getFails: true })
      });

      await captureStdout(() => tagger.markEnqueued('/repo', ['10']));

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on example.com/darthjee/arcanum\n'
      );
    });
  });

  describe('#mutateTag', () => {
    it('prints a "nothing to do" line to stdout and stops when adding an already-present label', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: ['Enqueued'] }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'add', 'enqueued')
      );

      expect(stdout).toEqual('Tag \'enqueued\' already present on issue #10 — nothing to do.\n');
    });

    it('prints a "nothing to do" line to stdout and stops when removing an absent label', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: [] }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'remove', 'ready_for_work')
      );

      expect(stdout).toEqual('Tag \'ready_for_work\' not present on issue #10 — nothing to do.\n');
    });

    it('prints a success line to stdout when adding a not-yet-present label', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: [] }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'add', 'enqueued')
      );

      expect(stdout).toEqual('Added tag \'enqueued\' to issue #10 on darthjee/arcanum\n');
    });

    it('prints a success line to stdout when removing a present label', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: ['Ready for Work'] }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'remove', 'ready_for_work')
      );

      expect(stdout).toEqual('Removed tag \'ready_for_work\' from issue #10 on darthjee/arcanum\n');
    });

    it('warns to stderr and prints nothing else when the labels fetch fails', async () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger({ fetchFn: fakeFetch({ getFails: true }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'add', 'enqueued')
      );

      expect(stdout).toEqual('');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });

    it('warns to stderr and prints nothing else when the mutation itself fails', async () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: [], mutateFails: true }) });

      const { stdout } = await captureStdout(() =>
        tagger.mutateTag('10', REPO, REPO, TOKEN, 'add', 'enqueued')
      );

      expect(stdout).toEqual('');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });
  });

  describe('#fetchLabels', () => {
    it('returns the issue\'s current label names', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ existingLabels: ['Ready for Work', 'Created'] }) });

      await expectAsync(tagger.fetchLabels('10', REPO, TOKEN)).toBeResolvedTo(['Ready for Work', 'Created']);
    });

    it('rejects when the fetch response is not ok', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ getFails: true }) });

      await expectAsync(tagger.fetchLabels('10', REPO, TOKEN)).toBeRejected();
    });
  });

  describe('#addLabel', () => {
    it('resolves when the add succeeds', async () => {
      const tagger = newTagger();

      await expectAsync(tagger.addLabel('10', REPO, TOKEN, 'Enqueued')).toBeResolved();
    });

    it('rejects when the add fails', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ mutateFails: true }) });

      await expectAsync(tagger.addLabel('10', REPO, TOKEN, 'Enqueued')).toBeRejected();
    });
  });

  describe('#removeLabel', () => {
    it('resolves when the remove succeeds', async () => {
      const tagger = newTagger();

      await expectAsync(tagger.removeLabel('10', REPO, TOKEN, 'Ready for Work')).toBeResolved();
    });

    it('rejects when the remove fails', async () => {
      const tagger = newTagger({ fetchFn: fakeFetch({ mutateFails: true }) });

      await expectAsync(tagger.removeLabel('10', REPO, TOKEN, 'Ready for Work')).toBeRejected();
    });
  });

  describe('#warnMutationFailure', () => {
    it('prints the add-side warning to stderr', () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger();

      tagger.warnMutationFailure('add', 'enqueued', '10', REPO);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });

    it('prints the remove-side warning to stderr', () => {
      spyOn(process.stderr, 'write');

      const tagger = newTagger();

      tagger.warnMutationFailure('remove', 'ready_for_work', '10', REPO);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'ready_for_work\' tag from issue #10 on darthjee/arcanum\n'
      );
    });
  });
});
