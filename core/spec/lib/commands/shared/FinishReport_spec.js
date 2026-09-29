import FinishReport from '../../../../lib/commands/shared/FinishReport.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';

describe('FinishReport', () => {
  let repoContext;
  let finishReport;
  const base = ['--skill', 'discuss-issue', '--status', 'success', '--summary', 'Saved the issue.'];

  beforeEach(() => {
    repoContext = {
      repoPath: '/tmp/repo',
      resolve: jasmine.createSpy('resolve').and.resolveTo({ domain: 'github.com', repo: 'darthjee/arcanum' })
    };
    finishReport = new FinishReport(repoContext);
  });

  describe('#run', () => {
    describe('report rendering', () => {
      ['success', 'declined', 'failed'].forEach((status) => {
        it(`prints the upper-cased ${status} header and the summary`, async () => {
          const output = await finishReport.run('--skill', 'plan-issue', '--status', status, '--summary', 'Done.');

          expect(output).toEqual(`== plan-issue: ${status.toUpperCase()} ==\nDone.\n`);
        });
      });

      it('omits every optional line and never resolves origin when none are set', async () => {
        await finishReport.run(...base);

        expect(repoContext.resolve).not.toHaveBeenCalled();
      });

      it('trims the summary', async () => {
        const output = await finishReport.run('--skill', 's', '--status', 'success', '--summary', '  hi there \n');

        expect(output).toEqual('== s: SUCCESS ==\nhi there\n');
      });

      it('prints every optional line in the contract order', async () => {
        const output = await finishReport.run(
          ...base,
          '--next', '/auto-fix-issue 12',
          '--label-change', 'enhancing:ready',
          '--sub-issue', '14',
          '--pr', '13',
          '--issue', '12',
          '--sub-issue', '15'
        );

        expect(output).toEqual(
          '== discuss-issue: SUCCESS ==\n' +
            'Saved the issue.\n' +
            'Issue: #12 https://github.com/darthjee/arcanum/issues/12\n' +
            'PR: #13 https://github.com/darthjee/arcanum/pull/13\n' +
            'Sub-issues: #14 #15\n' +
            'Labels: Enhancing -> Ready\n' +
            'Next: /auto-fix-issue 12\n'
        );
      });

      it('keeps repeatable label changes and next commands in order', async () => {
        const output = await finishReport.run(
          ...base,
          '--label-change', 'ready:working',
          '--label-change', 'created:ready_for_work',
          '--next', '/enhance-issue 2',
          '--next', '/enhance-issue 1'
        );

        expect(output).toEqual(
          '== discuss-issue: SUCCESS ==\n' +
            'Saved the issue.\n' +
            'Labels: Ready -> Working\n' +
            'Labels: Created -> Ready for Work\n' +
            'Next: /enhance-issue 2\n' +
            'Next: /enhance-issue 1\n'
        );
      });

      it('prints (none) for an add and for a remove', async () => {
        const output = await finishReport.run(...base, '--label-change', ':working', '--label-change', 'fetched:');

        expect(output).toContain('Labels: (none) -> Working\nLabels: Fetched -> (none)\n');
      });

      it('maps ssh.github.com to github.com in URLs', async () => {
        repoContext.resolve.and.resolveTo({ domain: 'ssh.github.com', repo: 'darthjee/arcanum' });

        const output = await finishReport.run(...base, '--issue', '7');

        expect(output).toContain('Issue: #7 https://github.com/darthjee/arcanum/issues/7\n');
      });

      it('uses any other domain as-is', async () => {
        repoContext.resolve.and.resolveTo({ domain: 'ghe.example.com', repo: 'org/app' });

        const output = await finishReport.run(...base, '--pr', '9');

        expect(output).toContain('PR: #9 https://ghe.example.com/org/app/pull/9\n');
      });

      it('propagates an origin resolution error', async () => {
        repoContext.resolve.and.rejectWith(new Error('Error: no origin'));

        const error = await captureRejection(finishReport.run(...base, '--issue', '7'));

        expect(error.message).toEqual('Error: no origin');
      });
    });

    describe('--nested', () => {
      it('prints the FINISH_* block with canonical tags and ignores --next', async () => {
        const output = await finishReport.run(
          ...base,
          '--nested',
          '--next', '/auto-fix-issue 12',
          '--label-change', ':working',
          '--sub-issue', '14',
          '--sub-issue', '15',
          '--pr', '13',
          '--issue', '12'
        );

        expect(output).toEqual(
          'FINISH_SKILL=discuss-issue\n' +
            'FINISH_STATUS=success\n' +
            'FINISH_SUMMARY=Saved the issue.\n' +
            'FINISH_ISSUE=12\n' +
            'FINISH_PR=13\n' +
            'FINISH_SUB_ISSUE=14\n' +
            'FINISH_SUB_ISSUE=15\n' +
            'FINISH_LABEL_CHANGE=:working\n'
        );
        expect(repoContext.resolve).not.toHaveBeenCalled();
      });

      it('prints only the mandatory keys when nothing else is set', async () => {
        const output = await finishReport.run(...base, '--nested');

        expect(output).toEqual(
          'FINISH_SKILL=discuss-issue\nFINISH_STATUS=success\nFINISH_SUMMARY=Saved the issue.\n'
        );
      });
    });

    describe('--merge', () => {
      const nestedBlock =
        'FINISH_SKILL=auto-plan-issue\n' +
        'FINISH_STATUS=success\n' +
        'FINISH_SUMMARY=Planned.\n' +
        'FINISH_ISSUE=12\n' +
        'FINISH_PR=40\n' +
        'FINISH_SUB_ISSUE=14\n' +
        'FINISH_SUB_ISSUE=16\n' +
        'FINISH_LABEL_CHANGE=ready:planning\n' +
        'SOMETHING_ELSE=ignored\n' +
        'not a key line\n';

      it('keeps the caller header/summary and fills Issue and PR when unset', async () => {
        const output = await finishReport.run(...base, '--merge', nestedBlock);

        expect(output).toEqual(
          '== discuss-issue: SUCCESS ==\n' +
            'Saved the issue.\n' +
            'Issue: #12 https://github.com/darthjee/arcanum/issues/12\n' +
            'PR: #40 https://github.com/darthjee/arcanum/pull/40\n' +
            'Sub-issues: #14 #16\n' +
            'Labels: Ready -> Planning\n'
        );
      });

      it('keeps the caller Issue and PR over the nested ones', async () => {
        const output = await finishReport.run(...base, '--issue', '1', '--pr', '2', '--merge', nestedBlock);

        expect(output).toContain('Issue: #1 https://github.com/darthjee/arcanum/issues/1\n');
        expect(output).toContain('PR: #2 https://github.com/darthjee/arcanum/pull/2\n');
      });

      it('appends nested sub-issues and label changes, dropping exact duplicates', async () => {
        const output = await finishReport.run(
          ...base,
          '--sub-issue', '16',
          '--label-change', 'ready:planning',
          '--label-change', 'enhancing:ready',
          '--merge', nestedBlock,
          '--merge', 'FINISH_STATUS=declined\nFINISH_SUB_ISSUE=17\nFINISH_SUB_ISSUE=14\n'
        );

        expect(output).toContain('Sub-issues: #16 #14 #17\n');
        expect(output).toContain('Labels: Ready -> Planning\nLabels: Enhancing -> Ready\n');
        expect(output.match(/Labels:/g).length).toEqual(2);
      });

      it('merges into the --nested block too', async () => {
        const output = await finishReport.run(...base, '--nested', '--merge', nestedBlock);

        expect(output).toEqual(
          'FINISH_SKILL=discuss-issue\n' +
            'FINISH_STATUS=success\n' +
            'FINISH_SUMMARY=Saved the issue.\n' +
            'FINISH_ISSUE=12\n' +
            'FINISH_PR=40\n' +
            'FINISH_SUB_ISSUE=14\n' +
            'FINISH_SUB_ISSUE=16\n' +
            'FINISH_LABEL_CHANGE=ready:planning\n'
        );
      });

      it('allows a nested failure when the caller does not report success', async () => {
        const output = await finishReport.run(
          '--skill', 's', '--status', 'failed', '--summary', 'x', '--merge', 'FINISH_STATUS=failed\n'
        );

        expect(output).toEqual('== s: FAILED ==\nx\n');
      });

      it('rejects a nested failure merged into a caller success', async () => {
        const error = await captureRejection(finishReport.run(...base, '--merge', 'FINISH_STATUS=failed\n'));

        expect(error).toEqual(jasmine.any(Error));
      });
    });

    describe('usage errors', () => {
      ['', '--skill'].forEach((repoPath) => {
        it(`throws on a missing or flag-like repo path (${JSON.stringify(repoPath)})`, async () => {
          const error = await captureRejection(new FinishReport({ repoPath, resolve: repoContext.resolve }).run(...base));

          expect(error.message).toEqual('Error: <repo_path> is required as the first argument');
        });
      });

      it('throws on an undefined repo path', async () => {
        const error = await captureRejection(new FinishReport({ resolve: repoContext.resolve }).run(...base));

        expect(error).toEqual(jasmine.any(Error));
      });

      const cases = {
        'a missing --skill': ['--status', 'success', '--summary', 'x'],
        'a missing --status': ['--skill', 's', '--summary', 'x'],
        'a missing --summary': ['--skill', 's', '--status', 'success'],
        'a blank --summary': ['--skill', 's', '--status', 'success', '--summary', '   '],
        'an invalid status': ['--skill', 's', '--status', 'done', '--summary', 'x'],
        'a multi-line summary': ['--skill', 's', '--status', 'success', '--summary', 'one\ntwo'],
        'an unknown flag': [...base, '--bogus'],
        'a stray positional': [...base, 'extra'],
        'a flag missing its value': [...base, '--issue'],
        'a non-numeric --issue': [...base, '--issue', 'abc'],
        'a non-numeric --pr': [...base, '--pr', '1a'],
        'a non-numeric --sub-issue': [...base, '--sub-issue', '#3'],
        'an unknown tag': [...base, '--label-change', 'ready:nope'],
        'a label change with both sides empty': [...base, '--label-change', ':'],
        'a label change with no colon': [...base, '--label-change', 'ready'],
        'a prototype-key tag': [...base, '--label-change', ':constructor'],
        'a non-numeric merged issue': [...base, '--merge', 'FINISH_ISSUE=abc\n'],
        'a non-numeric merged pr': [...base, '--merge', 'FINISH_PR=abc\n'],
        'a non-numeric merged sub-issue': [...base, '--merge', 'FINISH_SUB_ISSUE=abc\n'],
        'an unknown merged tag': [...base, '--merge', 'FINISH_LABEL_CHANGE=nope:\n']
      };

      Object.entries(cases).forEach(([description, args]) => {
        it(`throws on ${description}`, async () => {
          const error = await captureRejection(finishReport.run(...args));

          expect(error).toEqual(jasmine.any(Error));
          expect(error.message).toMatch(/^Error: /);
        });
      });
    });
  });
});
