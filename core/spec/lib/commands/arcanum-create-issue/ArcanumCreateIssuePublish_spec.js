import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumCreateIssuePublish from '../../../../lib/commands/arcanum-create-issue/ArcanumCreateIssuePublish.js';
import DraftStore from '../../../../lib/commands/arcanum-create-issue/DraftStore.js';
import GithubIssueService from '../../../../lib/services/GithubIssueService.js';
import TtyPrompt from '../../../../lib/utils/io/TtyPrompt.js';
import FakeTty from '../../../support/dummies/FakeTty.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('ArcanumCreateIssuePublish#run', () => {
  const URL = 'https://github.com/a/b/issues/42';
  let repoPath;
  let draft;
  let draftStore;
  let tty;
  let labelClient;
  let issueService;

  beforeEach(async () => {
    repoPath = await createTempDir();
    const dir = path.join(repoPath, '.claude/state/create-issue');

    await mkdir(dir, { recursive: true });
    draft = path.join(dir, '20261001-120000.md');
    await writeFile(draft, '# Draft title\n\n## Context\n\nSome body.\n');
    draftStore = new DraftStore({ repoPath });
    tty = new FakeTty({ available: false });
    labelClient = {
      listLabelNames: jasmine.createSpy('listLabelNames').and.resolveTo(['Writting', 'Epic', 'shipit', 'bug']),
      createLabel: jasmine.createSpy('createLabel').and.resolveTo()
    };
    issueService = {
      createWithLabels: jasmine.createSpy('createWithLabels').and.resolveTo({ number: 42, html_url: URL })
    };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  function newCommand() {
    return new ArcanumCreateIssuePublish(createRepoContextMock({ repoPath }), {
      draftStore, tty, labelClient, issueService
    });
  }

  function run(...args) {
    return newCommand().run(draft, 'The title', ...args);
  }

  async function draftExists() {
    return stat(draft).then(() => true, () => false);
  }

  function success(labels, epic, warnings = []) {
    return `STATUS=ok\nID=42\nURL=${URL}\nLABELS=${labels}\nEPIC=${epic}\n` +
      warnings.map((warning) => `WARNING=${warning}\n`).join('');
  }

  describe('with --confirmed', () => {
    it('creates the issue once with the matched labels and the stripped body, then deletes the draft', async () => {
      const output = await run('--confirmed', 'writting', 'BUG', 'Writting');

      expect(output).toEqual(success('Writting,bug', false));
      expect(issueService.createWithLabels).toHaveBeenCalledOnceWith(repoPath, {
        title: 'The title',
        body: '## Context\n\nSome body.',
        labels: ['Writting', 'bug']
      });
      expect(await draftExists()).toBeFalse();
    });

    it('reports EPIC=true when Epic is applied', async () => {
      expect(await run('--confirmed', 'epic')).toEqual(success('Epic', true));
    });

    it('creates the issue with no labels when every label is removed', async () => {
      expect(await run('--confirmed')).toEqual(success('', false));
      expect(labelClient.listLabelNames).not.toHaveBeenCalled();
      expect(issueService.createWithLabels).toHaveBeenCalledWith(repoPath, jasmine.objectContaining({ labels: [] }));
    });

    it('creates a missing label first and warns', async () => {
      expect(await run('--confirmed', 'Feature')).toEqual(success('Feature', false, ['created label Feature']));
      expect(labelClient.createLabel).toHaveBeenCalledOnceWith('Feature', 'ededed');
      expect(labelClient.createLabel).toHaveBeenCalledBefore(issueService.createWithLabels);
    });

    it('accepts flags in any position and trims the title', async () => {
      const output = await newCommand().run(draft, '  Spaced  ', 'bug', '--confirmed');

      expect(output).toEqual(success('bug', false));
      expect(issueService.createWithLabels).toHaveBeenCalledWith(repoPath, jasmine.objectContaining({ title: 'Spaced' }));
    });

    it('warns but succeeds when the draft cannot be deleted', async () => {
      spyOn(draftStore, 'delete').and.rejectWith(new Error('EACCES'));

      expect(await run('--confirmed')).toEqual(success('', false, [`draft not deleted: ${draft}`]));
    });
  });

  describe('failures', () => {
    it('exits 1 without retrying when the create fails, keeping the draft', async () => {
      issueService.createWithLabels.and.rejectWith(new Error('Error: could not create issue on a/b'));

      const error = await captureRejection(run('--confirmed', 'Feature'));

      expect(error.exitCode).toEqual(1);
      expect(error.stdout).toEqual(
        'STATUS=failed\n' +
        'ERROR=could not create issue on a/b (check GitHub before running again: the issue may have been created)\n' +
        'WARNING=created label Feature\n'
      );
      expect(issueService.createWithLabels).toHaveBeenCalledTimes(1);
      expect(await draftExists()).toBeTrue();
    });

    it('exits 1 when the labels cannot be listed, creating nothing', async () => {
      labelClient.listLabelNames.and.rejectWith(new Error('Error: could not list labels on a/b'));

      const error = await captureRejection(run('--confirmed', 'bug'));

      expect(error.exitCode).toEqual(1);
      expect(error.stdout).toEqual('STATUS=failed\nERROR=could not list labels on a/b\n');
      expect(issueService.createWithLabels).not.toHaveBeenCalled();
      expect(await draftExists()).toBeTrue();
    });
  });

  describe('invalid input (exit 2, nothing created)', () => {
    const usage = 'Usage: publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...';

    async function expectInvalid(promise, message) {
      const error = await captureRejection(promise);

      expect(error.exitCode).toEqual(2);
      expect(error.stdout).toEqual(`ERROR=${message}\n`);
      expect(issueService.createWithLabels).not.toHaveBeenCalled();
      expect(labelClient.createLabel).not.toHaveBeenCalled();
    }

    it('rejects missing arguments', async () => {
      await expectInvalid(newCommand().run(draft), usage);
      await expectInvalid(newCommand().run(), usage);
    });

    it('rejects an empty title', async () => {
      await expectInvalid(newCommand().run(draft, '   ', '--confirmed'), 'the title is empty');
    });

    it('rejects an unknown option', async () => {
      await expectInvalid(run('--confirm'), 'unknown option: --confirm');
    });

    for (const label of ['', 'a,b', 'a\nb']) {
      it(`rejects the malformed label ${JSON.stringify(label)}`, async () => {
        await expectInvalid(run('--confirmed', label), `malformed label: ${JSON.stringify(label)}`);
      });
    }

    it('rejects an unknown draft', async () => {
      await expectInvalid(newCommand().run('missing.md', 'T', '--confirmed'), 'unknown draft: missing.md');
    });

    it('rejects an empty body', async () => {
      await writeFile(draft, '# Only a title\n\n');

      await expectInvalid(run('--confirmed'), 'the draft body is empty');
      expect(await readFile(draft, 'utf8')).toEqual('# Only a title\n\n');
    });
  });

  describe('confirmations without a TTY', () => {
    it('exits 4 with FALLBACK=chat without --confirmed', async () => {
      const error = await captureRejection(run('bug'));

      expect(error.exitCode).toEqual(4);
      expect(error.stdout).toEqual('FALLBACK=chat\n');
      expect(issueService.createWithLabels).not.toHaveBeenCalled();
    });

    it('exits 4 with --confirmed but without --shipit-confirmed when shipit is requested', async () => {
      const error = await captureRejection(run('--confirmed', 'ShipIt'));

      expect(error.exitCode).toEqual(4);
      expect(error.stdout).toEqual('FALLBACK=chat\n');
      expect(labelClient.listLabelNames).not.toHaveBeenCalled();
    });

    it('applies shipit with --confirmed --shipit-confirmed', async () => {
      expect(await run('--confirmed', '--shipit-confirmed', 'shipit')).toEqual(success('shipit', false));
    });
  });

  describe('confirmations on the TTY', () => {
    it('shows the summary and creates the issue on Yes', async () => {
      tty = new FakeTty({ answers: ['maybe', 'Y'] });

      expect(await run('Epic', 'bug')).toEqual(success('Epic,bug', true));
      expect(tty.output).toContain('Title:  The title\nLabels: Epic, bug\nEpic:   yes\nBody:   3 lines\n');
      expect(tty.questions).toEqual([
        'Create this issue on GitHub? [Y]es / [N]o / [C]hat: ',
        'Create this issue on GitHub? [Y]es / [N]o / [C]hat: '
      ]);
      expect(tty.closed).toBeTrue();
    });

    it('shows "none" and Epic: no for an unlabeled issue', async () => {
      tty = new FakeTty({ answers: ['yes'] });

      await run();

      expect(tty.output).toContain('Labels: none\nEpic:   no\n');
    });

    for (const [answer, choice] of [['n', 'no'], ['No', 'no'], ['c', 'chat'], ['CHAT', 'chat']]) {
      it(`prints STATUS=declined and CHOICE=${choice} on "${answer}", creating nothing`, async () => {
        tty = new FakeTty({ answers: [answer] });

        expect(await run('bug')).toEqual(`STATUS=declined\nCHOICE=${choice}\n`);
        expect(issueService.createWithLabels).not.toHaveBeenCalled();
        expect(labelClient.listLabelNames).not.toHaveBeenCalled();
        expect(await draftExists()).toBeTrue();
      });
    }

    it('exits 4 when the TTY reaches EOF at prompt 5', async () => {
      tty = new FakeTty({ answers: [] });

      const error = await captureRejection(run('bug'));

      expect(error.exitCode).toEqual(4);
      expect(tty.closed).toBeTrue();
    });

    it('asks prompt 6 after prompt 5 and applies shipit on yes', async () => {
      tty = new FakeTty({ answers: ['y', 'what', 'yes'] });

      expect(await run('shipit')).toEqual(success('shipit', false));
      expect(tty.output).toContain('auto-fix-all will merge the PR as soon as CI passes, with no review.');
      expect(tty.questions.filter((question) => question === 'Apply shipit? [y/N]: ').length).toEqual(2);
    });

    it('drops shipit when prompt 6 defaults to No', async () => {
      tty = new FakeTty({ answers: [''] });

      expect(await run('--confirmed', 'bug', 'shipit')).toEqual(
        success('bug', false, ['shipit not confirmed; the issue was created without it'])
      );
      expect(issueService.createWithLabels).toHaveBeenCalledWith(repoPath, jasmine.objectContaining({ labels: ['bug'] }));
    });

    it('drops shipit on an explicit n', async () => {
      tty = new FakeTty({ answers: ['N'] });

      expect(await run('--confirmed', 'shipit')).toEqual(
        success('', false, ['shipit not confirmed; the issue was created without it'])
      );
    });

    it('exits 4 when the TTY reaches EOF at prompt 6', async () => {
      tty = new FakeTty({ answers: [] });

      const error = await captureRejection(run('--confirmed', 'shipit'));

      expect(error.exitCode).toEqual(4);
      expect(issueService.createWithLabels).not.toHaveBeenCalled();
    });
  });

  describe('defaults', () => {
    it('builds its own collaborators', () => {
      const command = new ArcanumCreateIssuePublish(createRepoContextMock({ repoPath }));

      expect(command._draftStore).toEqual(jasmine.any(DraftStore));
      expect(command._tty).toEqual(jasmine.any(TtyPrompt));
      expect(command._issueService).toEqual(jasmine.any(GithubIssueService));
      expect(command._labels._client.listLabelNames).toEqual(jasmine.any(Function));
    });
  });
});
