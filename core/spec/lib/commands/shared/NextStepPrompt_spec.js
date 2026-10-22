import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import NextStepPrompt from '../../../../lib/commands/shared/NextStepPrompt.js';
import ConfigChain from '../../../../lib/shared/config/ConfigChain.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import FakeTty from '../../../support/dummies/FakeTty.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const USAGE = 'Usage: next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... ' +
  '[--auto-key <skill>] [--no-prompt]\n';

describe('NextStepPrompt', () => {
  let repoPath;
  let globalDir;
  let env;
  let tty;
  let devices;
  let stderr;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir();
    env = { CLAUDE_CONFIG_DIR: globalDir };
    tty = new FakeTty();
    devices = [];
    stderr = { output: '', write(chunk) { this.output += chunk; return true; } };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  function newCommand() {
    return new NextStepPrompt({
      env,
      configChain: new ConfigChain({ env }),
      ttyFactory: (device) => {
        devices.push(device);
        return tty;
      },
      stderr
    });
  }

  async function writeRepoConfig(content) {
    const dir = path.join(repoPath, '.claude', 'configuration');

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'arcanum-repo-config.json'), JSON.stringify(content));
  }

  const evaluate = (...args) => newCommand().evaluate(args);

  describe('#evaluate argument validation', () => {
    const usageError = (message) => ({ stdout: '', stderr: `Error: ${message}\n${USAGE}`, exitCode: 1 });

    it('rejects a missing --repo', async () => {
      expect(await evaluate('--command', '/x')).toEqual(usageError('--repo is required'));
    });

    it('rejects an empty --repo', async () => {
      expect(await evaluate('--repo', '', '--command', '/x')).toEqual(usageError('--repo is required'));
    });

    it('rejects a non-directory --repo', async () => {
      const missing = path.join(repoPath, 'missing');

      expect(await evaluate('--repo', missing, '--command', '/x'))
        .toEqual(usageError(`--repo '${missing}' is not a directory`));
    });

    it('rejects no --command', async () => {
      expect(await evaluate('--repo', repoPath)).toEqual(usageError('at least one --command is required'));
    });

    it('rejects an empty --command', async () => {
      expect(await evaluate('--repo', repoPath, '--command', ''))
        .toEqual(usageError('--command must not be empty'));
    });

    it('rejects an empty --auto-key', async () => {
      expect(await evaluate('--repo', repoPath, '--command', '/x', '--auto-key', ''))
        .toEqual(usageError('--auto-key must not be empty'));
    });

    it('rejects a flag with no value', async () => {
      expect(await evaluate('--repo', repoPath, '--command')).toEqual(usageError('--command requires a value'));
    });

    it('rejects an unknown argument before the presence checks', async () => {
      expect(await evaluate('--bogus')).toEqual(usageError('unknown argument \'--bogus\''));
    });

    it('never probes the TTY on a usage error', async () => {
      await evaluate('--repo', repoPath);

      expect(devices).toEqual([]);
    });
  });

  describe('#evaluate auto mode', () => {
    const args = () => ['--repo', repoPath, '--command', '/first', '--command', '/second', '--auto-key', 'skill'];

    it('auto-continues when next_step.auto.<skill> is true', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true } } });

      expect(await evaluate(...args(), '--no-prompt')).toEqual({
        stdout: 'CHOICE=yes\nAUTO=true\n',
        stderr: 'auto-continuing: /first (next_step.auto.skill=true)\n',
        exitCode: 0
      });
      expect(devices).toEqual([]);
    });

    it('reads the global tier', async () => {
      await writeFile(path.join(globalDir, 'arcanum-config.json'), JSON.stringify({ next_step: { auto: { skill: true } } }));

      expect((await evaluate(...args())).stdout).toEqual('CHOICE=yes\nAUTO=true\n');
    });

    it('resolves a relative --repo against the cwd', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true } } });
      const relative = path.relative(process.cwd(), repoPath);

      expect((await evaluate('--repo', relative, '--command', '/x', '--auto-key', 'skill')).stdout)
        .toEqual('CHOICE=yes\nAUTO=true\n');
    });

    it('treats the string "true" as disabled', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: 'true' } } });

      expect(await evaluate(...args(), '--no-prompt')).toEqual({ stdout: 'CHOICE=no\n', stderr: '', exitCode: 0 });
    });

    it('treats an absent key as disabled', async () => {
      expect(await evaluate(...args(), '--no-prompt')).toEqual({ stdout: 'CHOICE=no\n', stderr: '', exitCode: 0 });
    });

    it('treats a config read failure as disabled', async () => {
      const command = new NextStepPrompt({
        env,
        configChain: { read: () => Promise.reject(new Error('boom')) },
        ttyFactory: () => tty,
        stderr
      });

      expect(await command.evaluate([...args(), '--no-prompt']))
        .toEqual({ stdout: 'CHOICE=no\n', stderr: '', exitCode: 0 });
    });
  });

  describe('#evaluate clear key', () => {
    const args = () => ['--repo', repoPath, '--command', '/first', '--auto-key', 'skill'];
    const plainAuto = {
      stdout: 'CHOICE=yes\nAUTO=true\n',
      stderr: 'auto-continuing: /first (next_step.auto.skill=true)\n',
      exitCode: 0
    };

    it('adds CLEAR=true and the two-key notice when both keys are true', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true }, clear: { skill: true } } });

      expect(await evaluate(...args())).toEqual({
        stdout: 'CHOICE=yes\nAUTO=true\nCLEAR=true\n',
        stderr: 'auto-continuing: /first (next_step.auto.skill=true, next_step.clear.skill=true)\n',
        exitCode: 0
      });
      expect(devices).toEqual([]);
    });

    it('reads the clear key across tiers (global auto, repo clear)', async () => {
      await writeFile(path.join(globalDir, 'arcanum-config.json'), JSON.stringify({ next_step: { auto: { skill: true } } }));
      await writeRepoConfig({ next_step: { clear: { skill: true } } });

      expect((await evaluate(...args())).stdout).toEqual('CHOICE=yes\nAUTO=true\nCLEAR=true\n');
    });

    it('lets a local false shadow a repo true', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true }, clear: { skill: true } } });
      const localDir = path.join(repoPath, '.claude', 'state');

      await mkdir(localDir, { recursive: true });
      await writeFile(path.join(localDir, 'arcanum-config.json'), JSON.stringify({ next_step: { clear: { skill: false } } }));

      expect(await evaluate(...args())).toEqual(plainAuto);
    });

    [
      ['false', false],
      ['the string "true"', 'true'],
      ['1', 1]
    ].forEach(([label, value]) => {
      it(`keeps the plain auto output when the clear key is ${label}`, async () => {
        await writeRepoConfig({ next_step: { auto: { skill: true }, clear: { skill: value } } });

        expect(await evaluate(...args())).toEqual(plainAuto);
      });
    });

    it('keeps the plain auto output when the clear key is absent', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true } } });

      expect(await evaluate(...args())).toEqual(plainAuto);
    });

    it('keeps the auto result when the clear read fails', async () => {
      const configChain = {
        read: (_repo, _section, key) => (key === 'auto.skill' ? Promise.resolve(true) : Promise.reject(new Error('boom')))
      };
      const command = new NextStepPrompt({ env, configChain, ttyFactory: () => tty, stderr });

      expect(await command.evaluate(args())).toEqual(plainAuto);
    });

    it('never emits CLEAR when auto is off (with --no-prompt)', async () => {
      await writeRepoConfig({ next_step: { clear: { skill: true } } });

      expect(await evaluate(...args(), '--no-prompt')).toEqual({ stdout: 'CHOICE=no\n', stderr: '', exitCode: 0 });
    });

    it('never emits CLEAR when auto is off (TTY fallback)', async () => {
      tty = new FakeTty({ available: false });
      await writeRepoConfig({ next_step: { clear: { skill: true } } });

      expect((await evaluate(...args())).stdout).toEqual('FALLBACK=chat\nCOMMAND=/first\n');
    });

    it('never emits CLEAR on a manual TTY yes', async () => {
      tty = new FakeTty({ answers: ['y'] });
      await writeRepoConfig({ next_step: { clear: { skill: true } } });

      expect(await evaluate(...args())).toEqual({ stdout: 'CHOICE=yes\n', stderr: '', exitCode: 0 });
    });

    it('does not read the clear key when auto did not fire', async () => {
      const configChain = jasmine.createSpyObj('configChain', ['read']);
      configChain.read.and.resolveTo(false);
      const command = new NextStepPrompt({ env, configChain, ttyFactory: () => tty, stderr });

      await command.evaluate([...args(), '--no-prompt']);

      expect(configChain.read.calls.allArgs()).toEqual([[path.resolve(repoPath), 'next_step', 'auto.skill']]);
    });

    it('does not read any key without --auto-key', async () => {
      const configChain = jasmine.createSpyObj('configChain', ['read']);
      const command = new NextStepPrompt({ env, configChain, ttyFactory: () => tty, stderr });

      await command.evaluate(['--repo', repoPath, '--command', '/first', '--no-prompt']);

      expect(configChain.read).not.toHaveBeenCalled();
    });

    it('reads the clear key once auto fired', async () => {
      const configChain = jasmine.createSpyObj('configChain', ['read']);
      configChain.read.and.resolveTo(true);
      const command = new NextStepPrompt({ env, configChain, ttyFactory: () => tty, stderr });

      await command.evaluate(args());

      expect(configChain.read.calls.allArgs()).toEqual([
        [path.resolve(repoPath), 'next_step', 'auto.skill'],
        [path.resolve(repoPath), 'next_step', 'clear.skill']
      ]);
    });
  });

  describe('#evaluate TTY prompt', () => {
    it('falls back to chat when the TTY cannot be opened', async () => {
      tty = new FakeTty({ available: false });

      expect(await evaluate('--repo', repoPath, '--command', '/a', '--command', '/b c')).toEqual({
        stdout: 'FALLBACK=chat\nCOMMAND=/a\nCOMMAND=/b c\n',
        stderr: '',
        exitCode: 4
      });
    });

    it('defaults to /dev/tty', async () => {
      await evaluate('--repo', repoPath, '--command', '/a');

      expect(devices).toEqual(['/dev/tty']);
    });

    it('honors ARCANUM_TTY_DEVICE', async () => {
      env.ARCANUM_TTY_DEVICE = '/nonexistent/tty';
      await evaluate('--repo', repoPath, '--command', '/a');

      expect(devices).toEqual(['/nonexistent/tty']);
    });

    it('shows a single command and maps yes to exit 0', async () => {
      tty = new FakeTty({ answers: ['Y'] });

      expect(await evaluate('--repo', repoPath, '--command', '/a'))
        .toEqual({ stdout: 'CHOICE=yes\n', stderr: '', exitCode: 0 });
      expect(tty.output).toEqual('Next step: /a\nRun it now? [Y]es / [N]o / [C]hat: ');
      expect(tty.closed).toBeTrue();
    });

    it('lists several commands', async () => {
      tty = new FakeTty({ answers: ['no'] });

      expect((await evaluate('--repo', repoPath, '--command', '/a', '--command', '/b')).stdout)
        .toEqual('CHOICE=no\n');
      expect(tty.output).toEqual('Next steps:\n  /a\n  /b\nRun it now? [Y]es / [N]o / [C]hat: ');
    });

    it('maps chat to exit 3 with the chat context', async () => {
      tty = new FakeTty({ answers: ['C hat'] });

      expect(await evaluate('--repo', repoPath, '--command', '/a'))
        .toEqual({ stdout: 'CHOICE=chat\nCHAT_CONTEXT=next_step\n', stderr: '', exitCode: 3 });
    });

    it('re-prompts on an invalid answer', async () => {
      tty = new FakeTty({ answers: ['maybe', 'YES'] });

      expect((await evaluate('--repo', repoPath, '--command', '/a')).stdout).toEqual('CHOICE=yes\n');
      expect(tty.questions.length).toEqual(2);
    });

    it('exits 1 when the TTY closes before a valid answer', async () => {
      tty = new FakeTty({ answers: ['maybe'] });

      expect(await evaluate('--repo', repoPath, '--command', '/a')).toEqual({
        stdout: '',
        stderr: 'Error: /dev/tty closed before a valid answer was given.\n',
        exitCode: 1
      });
    });
  });

  describe('#run', () => {
    it('returns stdout on exit 0', async () => {
      expect(await newCommand().run('--repo', repoPath, '--command', '/a', '--no-prompt')).toEqual('CHOICE=no\n');
      expect(stderr.output).toEqual('');
    });

    it('writes the stderr lines and throws a DispatchFailure on a non-zero exit', async () => {
      const error = await captureRejection(newCommand().run('--repo', repoPath));

      expect(error).toEqual(jasmine.any(DispatchFailure));
      expect(error.stdout).toEqual('');
      expect(error.exitCode).toEqual(1);
      expect(stderr.output).toEqual(`Error: at least one --command is required\n${USAGE}`);
    });

    it('carries the chat outcome as exit 3', async () => {
      tty = new FakeTty({ answers: ['c'] });
      const error = await captureRejection(newCommand().run('--repo', repoPath, '--command', '/a'));

      expect(error.stdout).toEqual('CHOICE=chat\nCHAT_CONTEXT=next_step\n');
      expect(error.exitCode).toEqual(3);
    });

    it('writes the auto-continuing notice to stderr', async () => {
      await writeRepoConfig({ next_step: { auto: { skill: true } } });

      expect(await newCommand().run('--repo', repoPath, '--command', '/a', '--auto-key', 'skill'))
        .toEqual('CHOICE=yes\nAUTO=true\n');
      expect(stderr.output).toEqual('auto-continuing: /a (next_step.auto.skill=true)\n');
    });

    it('rethrows unexpected errors', async () => {
      const command = newCommand();
      spyOn(command, 'parseArgs').and.rejectWith(new Error('boom'));

      expect((await captureRejection(command.run())).message).toEqual('boom');
    });
  });
});
