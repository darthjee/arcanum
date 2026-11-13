import path from 'node:path';
import AutoPlanIssueAutoNext from '../../../../lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('AutoPlanIssueAutoNext#run', () => {
  let repoPath;
  let git;
  let branch;
  let pushCode;
  let promptOutcome;
  let nextStepPrompt;
  let stderr;
  let githubIssueMark;
  let safeBranch;

  beforeEach(async () => {
    repoPath = await createTempDir();
    branch = { code: 0, stdout: 'issue-42\n' };
    pushCode = 0;
    promptOutcome = { stdout: 'CHOICE=yes\nAUTO=true\n', stderr: 'auto-continuing: notice\n', exitCode: 0 };
    git = jasmine.createSpy('git').and.callFake((args) =>
      Promise.resolve(args.includes('push') ? { code: pushCode, stdout: '' } : branch)
    );
    nextStepPrompt = { evaluate: jasmine.createSpy('evaluate').and.callFake(() => Promise.resolve(promptOutcome)) };
    stderr = { output: '', write(chunk) { this.output += chunk; return true; } };
    githubIssueMark = { markReady: jasmine.createSpy('markReady').and.resolveTo('') };
    safeBranch = { checkout: jasmine.createSpy('checkout').and.resolveTo('main') };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  function newCommand(target = repoPath) {
    return new AutoPlanIssueAutoNext(createRepoContextMock({ repoPath: target }), {
      nextStepPrompt, git, stderr, githubIssueMark, safeBranch
    });
  }

  async function expectUsageFailure(promise, message) {
    const error = await captureRejection(promise);

    expect(error).toEqual(jasmine.any(DispatchFailure));
    expect(error.stdout).toEqual('');
    expect(error.exitCode).toEqual(1);
    expect(stderr.output).toEqual(`${message}\n`);
  }

  describe('usage errors', () => {
    it('rejects a missing id', async () => {
      await expectUsageFailure(newCommand().run(), 'Usage: auto_next.sh <repo_path> <id>');
    });

    it('rejects a missing repo path', async () => {
      await expectUsageFailure(newCommand('').run('42'), 'Usage: auto_next.sh <repo_path> <id>');
    });

    it('rejects a non-directory repo path', async () => {
      const missing = path.join(repoPath, 'missing');

      await expectUsageFailure(newCommand(missing).run('42'), `Error: repo path '${missing}' is not a directory`);
      expect(git).not.toHaveBeenCalled();
    });
  });

  it('answers REASON=branch on another branch, without reading config', async () => {
    branch = { code: 0, stdout: 'main\n' };

    expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=branch\n');
    expect(git).toHaveBeenCalledWith(['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
    expect(nextStepPrompt.evaluate).not.toHaveBeenCalled();
    expect(git).not.toHaveBeenCalledWith(['-C', repoPath, 'push']);
    expect(githubIssueMark.markReady).not.toHaveBeenCalled();
    expect(safeBranch.checkout).not.toHaveBeenCalled();
  });

  it('answers REASON=branch when git fails', async () => {
    branch = { code: 128, stdout: '' };

    expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=branch\n');
  });

  it('asks NextStepPrompt in-process with the auto key and --no-prompt', async () => {
    await newCommand().run('42');

    expect(nextStepPrompt.evaluate).toHaveBeenCalledWith([
      '--repo', repoPath,
      '--command', '/loop /auto-resolve-issue 42',
      '--auto-key', 'auto-plan-issue',
      '--no-prompt'
    ]);
  });

  describe('when auto mode is off', () => {
    beforeEach(() => {
      promptOutcome = { stdout: 'CHOICE=no\n', stderr: '', exitCode: 0 };
    });

    it('pushes, marks ready and releases to the safe branch', async () => {
      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=config\nREADY=true\nRELEASED=true\n');
      expect(git).toHaveBeenCalledWith(['-C', repoPath, 'push']);
      expect(githubIssueMark.markReady).toHaveBeenCalledWith('42');
      expect(stderr.output).toEqual('BRANCH=main\n');
    });

    it('answers RELEASED=false when the release throws', async () => {
      safeBranch.checkout.and.rejectWith(new Error('Error: dirty'));

      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=config\nREADY=true\nRELEASED=false\n');
      expect(stderr.output).toEqual('Error: dirty\n');
    });

    it('answers READY=false but still releases when mark-ready throws', async () => {
      githubIssueMark.markReady.and.rejectWith(new Error('boom'));

      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=config\nREADY=false\nRELEASED=true\n');
      expect(safeBranch.checkout).toHaveBeenCalled();
    });

    it('answers REASON=push without marking or releasing when the push fails', async () => {
      pushCode = 1;

      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=push\n');
      expect(githubIssueMark.markReady).not.toHaveBeenCalled();
      expect(safeBranch.checkout).not.toHaveBeenCalled();
    });
  });

  it('fails when the prompt fails', async () => {
    promptOutcome = { stdout: '', stderr: 'Error: boom\n', exitCode: 1 };
    const error = await captureRejection(newCommand().run('42'));

    expect(error).toEqual(jasmine.any(DispatchFailure));
    expect(error.stdout).toEqual('');
    expect(error.exitCode).toEqual(1);
    expect(stderr.output).toEqual('Error: boom\nError: next_step_prompt.sh failed for auto key \'auto-plan-issue\'\n');
  });

  it('pushes, marks ready and answers CHAIN=yes without releasing', async () => {
    expect(await newCommand().run('42')).toEqual('CHAIN=yes\nREADY=true\n');
    expect(safeBranch.checkout).not.toHaveBeenCalled();
    expect(githubIssueMark.markReady).toHaveBeenCalledWith('42');
    expect(git).toHaveBeenCalledWith(['-C', repoPath, 'push']);
    expect(stderr.output).toEqual('auto-continuing: notice\n');
  });

  it('answers CHAIN=yes with READY=false when mark-ready throws', async () => {
    githubIssueMark.markReady.and.rejectWith(new Error('boom'));

    expect(await newCommand().run('42')).toEqual('CHAIN=yes\nREADY=false\n');
  });

  it('answers REASON=push when the push fails', async () => {
    pushCode = 1;

    expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=push\n');
    expect(githubIssueMark.markReady).not.toHaveBeenCalled();
    expect(safeBranch.checkout).not.toHaveBeenCalled();
  });

  describe('with next_step.clear.auto-plan-issue on', () => {
    beforeEach(() => {
      promptOutcome = {
        stdout: 'CHOICE=yes\nAUTO=true\nCLEAR=true\n',
        stderr: 'auto-continuing: /loop /auto-resolve-issue 42 ' +
          '(next_step.auto.auto-plan-issue=true, next_step.clear.auto-plan-issue=true)\n',
        exitCode: 0
      };
    });

    it('pushes and forwards CLEAR=true after CHAIN=yes', async () => {
      expect(await newCommand().run('42')).toEqual('CHAIN=yes\nCLEAR=true\nREADY=true\n');
      expect(git).toHaveBeenCalledWith(['-C', repoPath, 'push']);
    });

    it('passes the two-key notice through to stderr', async () => {
      await newCommand().run('42');

      expect(stderr.output).toEqual('auto-continuing: /loop /auto-resolve-issue 42 ' +
        '(next_step.auto.auto-plan-issue=true, next_step.clear.auto-plan-issue=true)\n');
    });

    it('answers REASON=push without CLEAR when the push fails', async () => {
      pushCode = 1;

      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=push\n');
    });

    it('answers REASON=branch without CLEAR on another branch', async () => {
      branch = { code: 0, stdout: 'main\n' };

      expect(await newCommand().run('42')).toEqual('CHAIN=no\nREASON=branch\n');
    });
  });

  it('ignores a CLEAR line that is not exactly CLEAR=true', async () => {
    promptOutcome = { stdout: 'CHOICE=yes\nAUTO=true\nCLEAR=truex\n', stderr: '', exitCode: 0 };

    expect(await newCommand().run('42')).toEqual('CHAIN=yes\nREADY=true\n');
  });

  describe('with the default git runner', () => {
    it('answers REASON=branch on a non-git directory', async () => {
      const command = new AutoPlanIssueAutoNext(createRepoContextMock({ repoPath }), { nextStepPrompt, stderr });

      expect(await command.run('42')).toEqual('CHAIN=no\nREASON=branch\n');
    });
  });
});
