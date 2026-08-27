import LabelApplicator from '../../../../lib/utils/issue/LabelApplicator.js';

const REPO_REF = 'darthjee/arcanum';

/**
 * Build a fake `execFileAsync` implementation that answers each `gh`
 * subcommand based on its argument shape.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.parentLabels] - labels returned by the parent
 *   `gh issue view --json labels` lookup.
 * @param {boolean} [opts.parentLabelsFail] - reject the labels lookup.
 * @param {boolean} [opts.editFail] - reject the `gh issue edit` call.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ parentLabels = [], parentLabelsFail = false, editFail = false } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd !== 'gh') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'issue' && args[1] === 'view' && args.includes('labels')) {
      if (parentLabelsFail) {
        throw new Error('gh: could not fetch labels');
      }

      return { stdout: `${parentLabels.join('\n')}\n` };
    }

    if (args[0] === 'issue' && args[1] === 'edit') {
      if (editFail) {
        throw new Error('gh: could not apply labels');
      }

      return { stdout: '' };
    }

    throw new Error(`unexpected gh invocation: ${JSON.stringify(args)}`);
  });
}

describe('LabelApplicator', () => {
  describe('#apply', () => {
    describe('parent label lookup failure fallback', () => {
      it('applies only Spawned and does not throw', async () => {
        const execFileAsync = fakeExecFileAsync({ parentLabelsFail: true });
        const labelApplicator = new LabelApplicator({ execFileAsync });

        spyOn(process.stderr, 'write');

        await labelApplicator.apply('1', '42', REPO_REF);

        const editCall = execFileAsync.calls.all().find((call) => call.args[1][1] === 'edit');

        expect(editCall.args[1]).toEqual(['issue', 'edit', '42', '-R', REPO_REF, '--add-label', 'Spawned']);
        expect(process.stderr.write).toHaveBeenCalledWith(
          jasmine.stringContaining(
            'Warning: could not fetch labels from parent issue #1 on darthjee/arcanum: gh: could not fetch labels — applying only \'Spawned\''
          )
        );
      });
    });

    describe('label filtering', () => {
      it('strips pipeline tags, keeps non-pipeline labels, and always adds Spawned once', async () => {
        const execFileAsync = fakeExecFileAsync({ parentLabels: ['Refined', 'Ready', 'Feature', 'Bug'] });
        const labelApplicator = new LabelApplicator({ execFileAsync });

        spyOn(process.stderr, 'write');

        await labelApplicator.apply('1', '42', REPO_REF);

        const editCall = execFileAsync.calls.all().find((call) => call.args[1][1] === 'edit');

        expect(editCall.args[1]).toEqual([
          'issue', 'edit', '42', '-R', REPO_REF,
          '--add-label', 'Feature', '--add-label', 'Bug', '--add-label', 'Spawned'
        ]);
      });
    });

    describe('edit failure', () => {
      it('warns to stderr and does not throw', async () => {
        const execFileAsync = fakeExecFileAsync({ editFail: true });
        const labelApplicator = new LabelApplicator({ execFileAsync });

        spyOn(process.stderr, 'write');

        await labelApplicator.apply('1', '42', REPO_REF);

        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not apply labels to issue #42 on darthjee/arcanum\n'
        );
      });
    });
  });
});
