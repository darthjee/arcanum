import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for arcanum/_lib/next_step_prompt.sh (issue #681). This is
// NOT a parity spec: the script has no native counterpart. It pins the
// "TTY-first with AskUserQuestion fallback" contract from
// docs/agents/plans/681-*/plan.md's "Shared contracts": when the TTY device
// cannot be opened the script prints `FALLBACK=chat` plus one `COMMAND=`
// line per `--command` and exits 4, while usage errors exit 1 with empty
// stdout — even with no TTY, since argument validation runs before the TTY
// probe. The test-only `ARCANUM_TTY_DEVICE` override points the TTY at a
// path that doesn't exist to simulate "no TTY". The interactive TTY paths
// (CHOICE=yes/no/chat) are out of scope here.
//
// It also pins the #714 auto-next flags (docs/agents/plans/714-*/plan.md's
// "Shared contracts"): `--auto-key <skill>` skips the offer (CHOICE=yes +
// AUTO=true, exit 0, notice on stderr) only when `next_step.auto.<skill>`
// resolves to JSON `true` through the local -> repo -> global config chain,
// and `--no-prompt` answers CHOICE=no without probing the TTY. Every run
// points CLAUDE_CONFIG_DIR/HOME at a temp folder so the real user's global
// config never leaks in, and runs from a cwd outside the temp repo so the
// local/repo tiers are proven to resolve from `--repo`, not the cwd.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'next_step_prompt.sh');

/**
 * Run next_step_prompt.sh with a non-existent TTY device and an isolated
 * config environment, and capture its stdout/stderr/exit code.
 * @param {string[]} args - the CLI arguments to pass to the script.
 * @param {string} ttyDevice - the `ARCANUM_TTY_DEVICE` value to use.
 * @param {object} [options] - extra run options.
 * @param {string} [options.cwd] - the working directory to run from.
 * @param {string} [options.configDir] - the `CLAUDE_CONFIG_DIR`/`HOME` value
 *   to use, so the real user's global config never leaks into the run.
 * @param {object} [options.env] - extra environment variables.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runPrompt(args, ttyDevice, { cwd, configDir, env = {} } = {}) {
  const isolatedDir = configDir ?? path.join(path.dirname(ttyDevice), 'global-config');

  try {
    const { stdout, stderr } = await execFileAsync(SCRIPT, args, {
      cwd,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: isolatedDir,
        HOME: isolatedDir,
        ARCANUM_TTY_DEVICE: ttyDevice,
        ...env
      }
    });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
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

describe('arcanum/_lib/next_step_prompt.sh (no TTY available)', () => {
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
  });
});

describe('arcanum/_lib/next_step_prompt.sh auto-next flags (issue #714)', () => {
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
