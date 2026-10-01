import { mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ArcanumCreateIssueStart from '../../../../lib/commands/arcanum-create-issue/ArcanumCreateIssueStart.js';
import DraftStore from '../../../../lib/commands/arcanum-create-issue/DraftStore.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import TtyPrompt from '../../../../lib/utils/io/TtyPrompt.js';
import FakeTty from '../../../support/dummies/FakeTty.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('ArcanumCreateIssueStart#run', () => {
  const NOW = new Date('2026-10-01T12:00:00Z');
  let repoPath;
  let dir;
  let preflight;
  let tty;

  beforeEach(async () => {
    repoPath = await createTempDir();
    dir = path.join(repoPath, '.claude/state/create-issue');
    preflight = { check: jasmine.createSpy('check').and.resolveTo() };
    tty = new FakeTty();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  function newCommand() {
    const context = createRepoContextMock({ repoPath });
    const draftStore = new DraftStore({ repoPath, now: () => NOW });

    return new ArcanumCreateIssueStart(context, { draftStore, tty, preflight, now: () => NOW });
  }

  async function writeDraft(name, content, mtime) {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, name);

    await writeFile(file, content);
    await utimes(file, mtime, mtime);

    return file;
  }

  const newFile = () => path.join(dir, '20261001-120000.md');

  describe('with no drafts', () => {
    it('creates a new draft without prompting', async () => {
      const output = await newCommand().run();

      expect(output).toEqual(`STATUS=new\nFILE=${newFile()}\n`);
      expect(tty.questions).toEqual([]);
    });
  });

  describe('with drafts', () => {
    let older;
    let newer;

    beforeEach(async () => {
      older = await writeDraft('a.md', '# Old idea\n', new Date('2026-09-28T12:00:00Z'));
      newer = await writeDraft('b.md', 'loose first line\n', new Date('2026-10-01T11:00:00Z'));
    });

    it('creates a fresh draft with --new, without prompting', async () => {
      expect(await newCommand().run('--new')).toEqual(`STATUS=new\nFILE=${newFile()}\n`);
      expect(tty.questions).toEqual([]);
    });

    it('resumes a draft with --resume, without prompting', async () => {
      expect(await newCommand().run('--resume', older)).toEqual(`STATUS=resumed\nFILE=${older}\n`);
      expect(tty.questions).toEqual([]);
    });

    it('accepts a repo-relative --resume path', async () => {
      expect(await newCommand().run('--resume', '.claude/state/create-issue/b.md'))
        .toEqual(`STATUS=resumed\nFILE=${newer}\n`);
    });

    it('lists the drafts on the TTY and resumes the chosen one', async () => {
      tty = new FakeTty({ answers: ['2'] });

      expect(await newCommand().run()).toEqual(`STATUS=resumed\nFILE=${older}\n`);
      expect(tty.output).toContain(`  [1] loose first line (2026-10-01T11:00:00Z, 1h ago)\n      ${newer}\n`);
      expect(tty.output).toContain(`  [2] Old idea (2026-09-28T12:00:00Z, 3d ago)\n      ${older}\n`);
      expect(tty.closed).toBeTrue();
    });

    it('starts a new draft when the TTY answer is N', async () => {
      tty = new FakeTty({ answers: ['n'] });

      expect(await newCommand().run()).toEqual(`STATUS=new\nFILE=${newFile()}\n`);
    });

    it('re-asks on an invalid or out-of-range answer', async () => {
      tty = new FakeTty({ answers: ['what', '9', 'New'] });

      expect(await newCommand().run()).toEqual(`STATUS=new\nFILE=${newFile()}\n`);
      expect(tty.questions.length).toEqual(3);
    });

    it('exits 4 with FALLBACK=chat and DRAFT lines, newest first, without a TTY', async () => {
      tty = new FakeTty({ available: false });

      const error = await captureRejection(newCommand().run());

      expect(error).toEqual(jasmine.any(DispatchFailure));
      expect(error.exitCode).toEqual(4);
      expect(error.stdout).toEqual(
        'FALLBACK=chat\n' +
        `DRAFT=${newer}\t2026-10-01T11:00:00Z\tloose first line\n` +
        `DRAFT=${older}\t2026-09-28T12:00:00Z\tOld idea\n`
      );
    });

    it('exits 4 when the TTY reaches EOF before an answer', async () => {
      tty = new FakeTty({ answers: [] });

      const error = await captureRejection(newCommand().run());

      expect(error.exitCode).toEqual(4);
      expect(tty.closed).toBeTrue();
    });

    it('shows (empty) for a blank draft in the TTY list', async () => {
      await writeDraft('c.md', '', NOW);
      tty = new FakeTty({ answers: ['1'] });

      await newCommand().run();

      expect(tty.output).toContain('[1] (empty) (2026-10-01T12:00:00Z, 0s ago)');
    });
  });

  describe('invalid input', () => {
    const cases = [
      { name: 'an unknown flag', args: ['--bogus'] },
      { name: '--resume without a draft', args: ['--resume'] },
      { name: '--resume with an empty draft', args: ['--resume', ''] },
      { name: 'both flags', args: ['--new', '--resume', 'x'] }
    ];

    for (const { name, args } of cases) {
      it(`exits 2 on ${name}, before the preflight`, async () => {
        const error = await captureRejection(newCommand().run(...args));

        expect(error.exitCode).toEqual(2);
        expect(error.stdout).toEqual('ERROR=Usage: start.sh <repo_path> [--new | --resume <draft>]\n');
        expect(preflight.check).not.toHaveBeenCalled();
      });
    }

    it('exits 2 on an unknown --resume draft', async () => {
      const error = await captureRejection(newCommand().run('--resume', 'nope.md'));

      expect(error.exitCode).toEqual(2);
      expect(error.stdout).toEqual('ERROR=unknown draft: nope.md\n');
      expect(preflight.check).not.toHaveBeenCalled();
    });
  });

  describe('preflight failure', () => {
    it('exits 1 with STATUS=error and creates no draft', async () => {
      preflight.check.and.rejectWith(new Error('origin is not a GitHub remote: gitlab.com/a/b'));

      const error = await captureRejection(newCommand().run('--new'));

      expect(error.exitCode).toEqual(1);
      expect(error.stdout).toEqual('STATUS=error\nERROR=origin is not a GitHub remote: gitlab.com/a/b\n');
      expect(await new DraftStore({ repoPath }).list()).toEqual([]);
    });
  });

  describe('defaults', () => {
    it('builds its own draft store, TTY prompt and preflight', () => {
      const command = new ArcanumCreateIssueStart(createRepoContextMock({ repoPath }));

      expect(command._draftStore).toEqual(jasmine.any(DraftStore));
      expect(command._tty).toEqual(jasmine.any(TtyPrompt));
      expect(command._preflight.check).toEqual(jasmine.any(Function));
      expect(command._now()).toEqual(jasmine.any(Date));
    });
  });
});
