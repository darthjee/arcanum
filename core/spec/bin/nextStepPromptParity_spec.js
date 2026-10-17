import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NATIVE_BIN, REPO_ROOT, expectParity, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity spec for the "next-step-prompt" dispatched command (issue #760,
// originally the #681/#714 contract spec for arcanum/_lib/next_step_prompt.sh).
// Every case runs arcanum/_lib/next_step_prompt_shell.sh directly (NOT
// through the next_step_prompt.sh engine_dispatch shim, so this spec isn't
// circular) and `core/bin/arcanum next-step-prompt` with the same flags,
// env and cwd, asserting identical stdout, stderr and exit code (the
// `Usage:` line's script name is normalized, since the shell prints its
// own `$0`), then pins the contract on the shell result.
//
// The contract (docs/agents/architecture/skill-finish.md): when the TTY
// device cannot be opened the command prints `FALLBACK=chat` plus one
// `COMMAND=` line per `--command` and exits 4, while usage errors exit 1
// with empty stdout — even with no TTY, since argument validation runs
// before the TTY probe. The test-only `ARCANUM_TTY_DEVICE` override points
// the TTY at a path that doesn't exist to simulate "no TTY". The
// interactive TTY paths (CHOICE=yes/no/chat) are out of scope here.
//
// It also pins the #714 auto-next flags: `--auto-key <skill>` skips the
// offer (CHOICE=yes + AUTO=true, exit 0, notice on stderr) only when
// `next_step.auto.<skill>` resolves to JSON `true` through the local ->
// repo -> global config chain, and `--no-prompt` answers CHOICE=no without
// probing the TTY. Every run points CLAUDE_CONFIG_DIR/HOME at a temp folder
// so the real user's global config never leaks in, and runs from a cwd
// outside the temp repo so the local/repo tiers are proven to resolve from
// `--repo`, not the cwd.

const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'next_step_prompt_shell.sh');

/**
 * Replaces the script name on `Usage:` lines, which the shell takes from
 * its own `$0`.
 * @param {string} stderr - a side's stderr.
 * @returns {string} the normalized stderr.
 */
function normalizeUsage(stderr) {
  return stderr.replace(/^Usage: \S+ /gm, 'Usage: <script> ');
}

/**
 * Run next-step-prompt on both engines with a non-existent TTY device and
 * an isolated config environment, assert shell/native parity (stdout,
 * normalized stderr and exit code), and return the shell side's result.
 * @param {string[]} args - the CLI arguments to pass to the command.
 * @param {string} ttyDevice - the `ARCANUM_TTY_DEVICE` value to use.
 * @param {object} [options] - extra run options.
 * @param {string} [options.cwd] - the working directory to run from.
 * @param {string} [options.configDir] - the `CLAUDE_CONFIG_DIR`/`HOME` value
 *   to use, so the real user's global config never leaks into the run.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the shell side's result.
 */
async function runPrompt(args, ttyDevice, { cwd, configDir } = {}) {
  const isolatedDir = configDir ?? path.join(path.dirname(ttyDevice), 'global-config');
  const env = { ...process.env, CLAUDE_CONFIG_DIR: isolatedDir, HOME: isolatedDir, ARCANUM_TTY_DEVICE: ttyDevice };
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd, env);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'next-step-prompt', ...args], cwd, env);

  expectParity(shell, native);
  expect(normalizeUsage(native.stderr)).toEqual(normalizeUsage(shell.stderr));

  return shell;
}

/**
 * Write a JSON config file, creating its parent folders as needed.
 * @param {string} file - the absolute file path.
 * @param {object} content - the JSON content to write.
 * @returns {Promise<void>} resolves once written.
 */
async function writeJson(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(content)}\n`);
}

/**
 * Build the `{"next_step": {"auto": {<skill>: <value>}}}` config shape.
 * @param {string} skill - the skill name.
 * @param {boolean|string|null} value - the value to store under `next_step.auto.<skill>`.
 * @returns {object} the config object.
 */
function autoConfig(skill, value) {
  return { next_step: { auto: { [skill]: value } } };
}

/**
 * Write the local state tier (`<repo>/.claude/state/arcanum-config.json`).
 * @param {string} repo - the temp repo path.
 * @param {object} content - the JSON content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeLocalConfig(repo, content) {
  await writeJson(path.join(repo, '.claude', 'state', 'arcanum-config.json'), content);
}

/**
 * Write the repo config tier
 * (`<repo>/.claude/configuration/arcanum-repo-config.json`).
 * @param {string} repo - the temp repo path.
 * @param {object} content - the JSON content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeRepoConfig(repo, content) {
  await writeJson(
    path.join(repo, '.claude', 'configuration', 'arcanum-repo-config.json'),
    content
  );
}

/**
 * Write the global config tier (`<configDir>/arcanum-config.json`).
 * @param {string} configDir - the temp `CLAUDE_CONFIG_DIR`.
 * @param {object} content - the JSON content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeGlobalConfig(configDir, content) {
  await writeJson(path.join(configDir, 'arcanum-config.json'), content);
}

describe('next-step-prompt parity (shell vs. native, no TTY available)', () => {
  let tempDir;
  let ttyDevice;

  beforeEach(async () => {
    tempDir = await createTempDir();
    ttyDevice = path.join(tempDir, 'missing-tty');
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  describe('with a single --command', () => {
    it('prints the chat fallback and exits 4', async () => {
      const result = await runPrompt(
        ['--repo', tempDir, '--command', '/auto-fix-issue 1'],
        ttyDevice
      );

      expect(result.code).toBe(4);
      expect(result.stdout).toBe('FALLBACK=chat\nCOMMAND=/auto-fix-issue 1\n');
    });
  });

  describe('with several --command flags', () => {
    it('prints one COMMAND= line per command, in order, and exits 4', async () => {
      const result = await runPrompt(
        [
          '--repo', tempDir,
          '--command', '/auto-fix-issue 1',
          '--command', '/auto-fix-issue 2',
          '--command', '/auto-monitor-issue-pr 3'
        ],
        ttyDevice
      );

      expect(result.code).toBe(4);
      expect(result.stdout).toBe(
        'FALLBACK=chat\n' +
        'COMMAND=/auto-fix-issue 1\n' +
        'COMMAND=/auto-fix-issue 2\n' +
        'COMMAND=/auto-monitor-issue-pr 3\n'
      );
    });
  });

  describe('usage errors (validated before the TTY probe)', () => {
    it('exits 1 with empty stdout when --repo is missing', async () => {
      const result = await runPrompt(['--command', '/auto-fix-issue 1'], ttyDevice);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when --command is missing', async () => {
      const result = await runPrompt(['--repo', tempDir], ttyDevice);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when --command is empty', async () => {
      const result = await runPrompt(['--repo', tempDir, '--command', ''], ttyDevice);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when --repo is not a directory', async () => {
      const notADir = path.join(tempDir, 'a-file');

      await writeFile(notADir, 'not a directory\n');

      const result = await runPrompt(
        ['--repo', notADir, '--command', '/auto-fix-issue 1'],
        ttyDevice
      );

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    const moreUsageErrors = {
      'when --repo is empty': () => ['--repo', '', '--command', '/x'],
      'when --repo does not exist': (dir) => ['--repo', path.join(dir, 'missing'), '--command', '/x'],
      'when --repo has no value': () => ['--command', '/x', '--repo'],
      'on an unknown argument': (dir) => ['--repo', dir, '--command', '/x', '--bogus'],
      'when --no-prompt is given with no --command': (dir) => ['--repo', dir, '--no-prompt']
    };

    Object.entries(moreUsageErrors).forEach(([label, buildArgs]) => {
      it(`exits 1 with empty stdout ${label}`, async () => {
        const result = await runPrompt(buildArgs(tempDir), ttyDevice);

        expect(result.code).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatch(/^Error: .*\nUsage: /);
      });
    });
  });
});

describe('next-step-prompt parity: auto-next flags (issue #714)', () => {
  const SKILL = 'enhance-issue';
  const COMMAND = '/discuss-issue 714';
  const FALLBACK = `FALLBACK=chat\nCOMMAND=${COMMAND}\n`;
  const AUTO_OUTPUT = 'CHOICE=yes\nAUTO=true\n';
  const NOTICE = `auto-continuing: ${COMMAND} (next_step.auto.${SKILL}=true)`;

  let tempDir;
  let repo;
  let configDir;
  let ttyDevice;

  /**
   * Run the script against the temp repo with the isolated config dir, from
   * a cwd outside the repo.
   * @param {string[]} extraArgs - arguments appended after `--repo <repo>`.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
   */
  const run = (extraArgs) => runPrompt(
    ['--repo', repo, ...extraArgs],
    ttyDevice,
    { cwd: tempDir, configDir }
  );

  beforeEach(async () => {
    tempDir = await createTempDir();
    repo = path.join(tempDir, 'repo');
    configDir = path.join(tempDir, 'global-config');
    ttyDevice = path.join(tempDir, 'missing-tty');
    await mkdir(repo, { recursive: true });
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  describe('--auto-key with the key enabled', () => {
    beforeEach(async () => {
      await writeRepoConfig(repo, autoConfig(SKILL, true));
    });

    it('auto-continues without probing the TTY', async () => {
      const result = await run(['--command', COMMAND, '--auto-key', SKILL]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe(AUTO_OUTPUT);
      expect(result.stderr).toContain(NOTICE);
    });

    it('names only the first command in the notice', async () => {
      const result = await run([
        '--command', COMMAND,
        '--command', '/auto-plan-issue 714',
        '--auto-key', SKILL
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe(AUTO_OUTPUT);
      expect(result.stderr).toContain(NOTICE);
      expect(result.stderr).not.toContain('/auto-plan-issue 714');
    });
  });

  describe('resolving the key from each tier alone', () => {
    const tiers = {
      local: () => writeLocalConfig(repo, autoConfig(SKILL, true)),
      repo: () => writeRepoConfig(repo, autoConfig(SKILL, true)),
      global: () => writeGlobalConfig(configDir, autoConfig(SKILL, true))
    };

    Object.entries(tiers).forEach(([tier, write]) => {
      it(`auto-continues when only the ${tier} tier enables it`, async () => {
        await write();

        const result = await run(['--command', COMMAND, '--auto-key', SKILL]);

        expect(result.code).toBe(0);
        expect(result.stdout).toBe(AUTO_OUTPUT);
        expect(result.stderr).toContain(NOTICE);
      });
    });
  });

  describe('tier precedence', () => {
    it('lets local false beat repo true', async () => {
      await writeLocalConfig(repo, autoConfig(SKILL, false));
      await writeRepoConfig(repo, autoConfig(SKILL, true));

      const result = await run(['--command', COMMAND, '--auto-key', SKILL]);

      expect(result.code).toBe(4);
      expect(result.stdout).toBe(FALLBACK);
    });

    it('lets repo true beat global false', async () => {
      await writeRepoConfig(repo, autoConfig(SKILL, true));
      await writeGlobalConfig(configDir, autoConfig(SKILL, false));

      const result = await run(['--command', COMMAND, '--auto-key', SKILL]);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe(AUTO_OUTPUT);
    });
  });

  describe('--auto-key with the key not enabled', () => {
    const cases = {
      'absent': null,
      'false': autoConfig(SKILL, false),
      'null': autoConfig(SKILL, null),
      'the string "true"': autoConfig(SKILL, 'true'),
      'enabled for another skill only': autoConfig('discuss-issue', true)
    };

    Object.entries(cases).forEach(([label, config]) => {
      it(`keeps today's fallback when the key is ${label}`, async () => {
        if (config) {
          await writeRepoConfig(repo, config);
        }

        const result = await run(['--command', COMMAND, '--auto-key', SKILL]);

        expect(result.code).toBe(4);
        expect(result.stdout).toBe(FALLBACK);
        expect(result.stdout).not.toContain('AUTO=');
        expect(result.stderr).not.toContain('auto-continuing');
      });
    });
  });

  describe('every tier and value', () => {
    const writers = {
      local: (content) => writeLocalConfig(repo, content),
      repo: (content) => writeRepoConfig(repo, content),
      global: (content) => writeGlobalConfig(configDir, content)
    };
    const values = { 'true': true, 'false': false, 'the string "true"': 'true', 'absent': undefined };

    Object.entries(writers).forEach(([tier, write]) => {
      Object.entries(values).forEach(([label, value]) => {
        it(`matches when the ${tier} tier holds ${label}, with and without --no-prompt`, async () => {
          if (value !== undefined) {
            await write(autoConfig(SKILL, value));
          }

          const prompted = await run(['--command', COMMAND, '--auto-key', SKILL]);
          const silent = await run(['--command', COMMAND, '--auto-key', SKILL, '--no-prompt']);

          if (value === true) {
            expect(prompted).toEqual({ stdout: AUTO_OUTPUT, stderr: `${NOTICE}\n`, code: 0 });
            expect(silent).toEqual({ stdout: AUTO_OUTPUT, stderr: `${NOTICE}\n`, code: 0 });
          } else {
            expect(prompted).toEqual({ stdout: FALLBACK, stderr: '', code: 4 });
            expect(silent).toEqual({ stdout: 'CHOICE=no\n', stderr: '', code: 0 });
          }
        });
      });
    });
  });

  describe('--no-prompt', () => {
    it('answers CHOICE=no without --auto-key', async () => {
      const result = await run(['--command', COMMAND, '--no-prompt']);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHOICE=no\n');
    });

    it('answers CHOICE=no when --auto-key is not enabled', async () => {
      const result = await run(['--command', COMMAND, '--auto-key', SKILL, '--no-prompt']);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CHOICE=no\n');
    });

    it('auto-continues when --auto-key is enabled', async () => {
      await writeRepoConfig(repo, autoConfig(SKILL, true));

      const result = await run(['--command', COMMAND, '--auto-key', SKILL, '--no-prompt']);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe(AUTO_OUTPUT);
      expect(result.stderr).toContain(NOTICE);
    });
  });

  describe('usage errors', () => {
    beforeEach(async () => {
      await writeRepoConfig(repo, autoConfig(SKILL, true));
    });

    it('exits 1 with empty stdout when --auto-key has no value', async () => {
      const result = await run(['--command', COMMAND, '--auto-key']);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('exits 1 with empty stdout when --auto-key is empty', async () => {
      const result = await run(['--command', COMMAND, '--auto-key', '']);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });

    it('validates arguments before reading config', async () => {
      const result = await run(['--command', COMMAND, '--auto-key', SKILL, '--bogus']);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });
  });
});

describe('next-step-prompt parity: clear key (issue #796)', () => {
  const SKILL = 'enhance-issue';
  const COMMAND = '/discuss-issue 796';
  const AUTO_OUTPUT = 'CHOICE=yes\nAUTO=true\n';
  const CLEAR_OUTPUT = 'CHOICE=yes\nAUTO=true\nCLEAR=true\n';
  const NOTICE = `auto-continuing: ${COMMAND} (next_step.auto.${SKILL}=true)\n`;
  const CLEAR_NOTICE = `auto-continuing: ${COMMAND} (next_step.auto.${SKILL}=true, next_step.clear.${SKILL}=true)\n`;
  const PLAIN_AUTO = { stdout: AUTO_OUTPUT, stderr: NOTICE, code: 0 };

  let tempDir;
  let repo;
  let configDir;
  let ttyDevice;

  /**
   * Run the script against the temp repo with the isolated config dir, from
   * a cwd outside the repo.
   * @param {string[]} extraArgs - arguments appended after `--repo <repo>`.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
   */
  const run = (extraArgs = []) => runPrompt(
    ['--repo', repo, '--command', COMMAND, '--auto-key', SKILL, ...extraArgs],
    ttyDevice,
    { cwd: tempDir, configDir }
  );

  /**
   * Build the `next_step` config with the given auto/clear values for SKILL.
   * @param {object} values - the values to set.
   * @param {(boolean|string|number|null)} [values.auto] - `next_step.auto.<skill>` (omitted when undefined).
   * @param {(boolean|string|number|null)} [values.clear] - `next_step.clear.<skill>` (omitted when undefined).
   * @returns {object} the config object.
   */
  function nextStepConfig({ auto, clear }) {
    const nextStep = {};

    if (auto !== undefined) {
      nextStep.auto = { [SKILL]: auto };
    }

    if (clear !== undefined) {
      nextStep.clear = { [SKILL]: clear };
    }

    return { next_step: nextStep };
  }

  beforeEach(async () => {
    tempDir = await createTempDir();
    repo = path.join(tempDir, 'repo');
    configDir = path.join(tempDir, 'global-config');
    ttyDevice = path.join(tempDir, 'missing-tty');
    await mkdir(repo, { recursive: true });
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  it('prints CLEAR=true and the two-key notice when both keys are true', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: true, clear: true }));

    expect(await run()).toEqual({ stdout: CLEAR_OUTPUT, stderr: CLEAR_NOTICE, code: 0 });
    expect(await run(['--no-prompt'])).toEqual({ stdout: CLEAR_OUTPUT, stderr: CLEAR_NOTICE, code: 0 });
  });

  it('keeps the plain auto output when the clear key is false', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: true, clear: false }));

    expect(await run()).toEqual(PLAIN_AUTO);
  });

  it('resolves mixed tiers (auto in global, clear in repo)', async () => {
    await writeGlobalConfig(configDir, nextStepConfig({ auto: true }));
    await writeRepoConfig(repo, nextStepConfig({ clear: true }));

    expect(await run()).toEqual({ stdout: CLEAR_OUTPUT, stderr: CLEAR_NOTICE, code: 0 });
  });

  it('lets a local false shadow a repo true', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: true, clear: true }));
    await writeLocalConfig(repo, nextStepConfig({ clear: false }));

    expect(await run()).toEqual(PLAIN_AUTO);
  });

  [
    ['the string "true"', 'true'],
    ['1', 1],
    ['null', null]
  ].forEach(([label, value]) => {
    it(`keeps the plain auto output when the clear key is ${label}`, async () => {
      await writeRepoConfig(repo, nextStepConfig({ auto: true, clear: value }));

      expect(await run()).toEqual(PLAIN_AUTO);
    });
  });

  it('keeps the plain auto output when the clear key is absent', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: true }));

    expect(await run()).toEqual(PLAIN_AUTO);
  });

  it('keeps the auto result when the clear key\'s tiers are malformed', async () => {
    await writeLocalConfig(repo, nextStepConfig({ auto: true }));
    await mkdir(path.join(repo, '.claude', 'configuration'), { recursive: true });
    await writeFile(path.join(repo, '.claude', 'configuration', 'arcanum-repo-config.json'), '{ not json\n');
    await writeFile(path.join(configDir, 'arcanum-config.json'), '{ not json\n');

    expect(await run()).toEqual(PLAIN_AUTO);
  });

  it('never emits CLEAR when auto is off, with or without --no-prompt', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: false, clear: true }));

    expect(await run(['--no-prompt'])).toEqual({ stdout: 'CHOICE=no\n', stderr: '', code: 0 });
    expect(await run()).toEqual({ stdout: `FALLBACK=chat\nCOMMAND=${COMMAND}\n`, stderr: '', code: 4 });
  });

  it('never emits CLEAR without --auto-key', async () => {
    await writeRepoConfig(repo, nextStepConfig({ auto: true, clear: true }));

    const result = await runPrompt(
      ['--repo', repo, '--command', COMMAND, '--no-prompt'],
      ttyDevice,
      { cwd: tempDir, configDir }
    );

    expect(result).toEqual({ stdout: 'CHOICE=no\n', stderr: '', code: 0 });
  });
});
