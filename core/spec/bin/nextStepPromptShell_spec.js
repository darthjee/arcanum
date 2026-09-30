import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
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

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'next_step_prompt.sh');

/**
 * Run next_step_prompt.sh with a non-existent TTY device and capture its
 * stdout/stderr/exit code.
 * @param {string[]} args - the CLI arguments to pass to the script.
 * @param {string} ttyDevice - the `ARCANUM_TTY_DEVICE` value to use.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runPrompt(args, ttyDevice) {
  try {
    const { stdout, stderr } = await execFileAsync(SCRIPT, args, {
      env: { ...process.env, ARCANUM_TTY_DEVICE: ttyDevice }
    });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
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
