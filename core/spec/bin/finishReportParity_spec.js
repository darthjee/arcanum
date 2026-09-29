import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';
import { NATIVE_BIN, REPO_ROOT, expectParity, runCommand } from '../support/utils/runCommand.js';

// Parity test for the "finish-report" migrated entrypoint (issue #660)
// — see docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and docs/agents/architecture/skill-finish.md. Runs
// arcanum/_lib/finish_report_shell.sh directly (NOT through the
// arcanum/_lib/finish_report.sh engine_dispatch shim — so this test
// isn't circular) and `core/bin/arcanum finish-report` against the
// same temp git repo (with a seeded `origin`), asserting byte-identical
// stdout and exit code.

const execFileAsync = promisify(execFile);

const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'finish_report_shell.sh');
const BASE = ['--skill', 'discuss-issue', '--status', 'success', '--summary', 'Saved the issue.'];
const NESTED_BLOCK =
  'FINISH_SKILL=auto-plan-issue\n' +
  'FINISH_STATUS=success\n' +
  'FINISH_SUMMARY=Planned.\n' +
  'FINISH_ISSUE=12\n' +
  'FINISH_PR=40\n' +
  'FINISH_SUB_ISSUE=14\n' +
  'FINISH_SUB_ISSUE=16\n' +
  'FINISH_LABEL_CHANGE=ready:planning\n' +
  'UNKNOWN_LINE=ignored\n';

/**
 * Run `finish-report` on both engines against `repoPath`.
 * @param {string} repoPath - the `<repo_path>` argument.
 * @param {string[]} args - the flags following `<repo_path>`.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(repoPath, args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, repoPath, ...args], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'finish-report', repoPath, ...args], cwd);

  return { shell, native };
}

describe('finish-report parity (shell vs. native)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-finish-report-parity-');
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);
    await execFileAsync('git', ['-C', repoPath, 'remote', 'add', 'origin', 'git@github.com:darthjee/arcanum.git']);
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string[]} args - the flags following `<repo_path>`.
   * @param {number} expectedCode - the exit code both sides must share.
   * @returns {Promise<{shell: object, native: object}>} both sides' results.
   */
  async function assertParity(args, expectedCode = 0) {
    const results = await runBoth(repoPath, args, repoPath);

    expectParity(results.shell, results.native);
    expect(results.shell.code).toEqual(expectedCode);

    if (expectedCode !== 0) {
      expect(results.shell.stdout).toEqual('');
    }

    return results;
  }

  ['success', 'declined', 'failed'].forEach((status) => {
    describe(`a ${status} report with no optional lines`, () => {
      it('matches byte-for-byte', async () => {
        await assertParity(['--skill', 'plan-issue', '--status', status, '--summary', '  Done.  ']);
      });
    });
  });

  describe('a report with every optional line', () => {
    it('matches byte-for-byte', async () => {
      const { shell } = await assertParity([
        ...BASE,
        '--next', '/auto-fix-issue 12',
        '--label-change', 'enhancing:ready',
        '--label-change', ':working',
        '--label-change', 'fetched:',
        '--sub-issue', '14',
        '--pr', '13',
        '--issue', '12',
        '--sub-issue', '15',
        '--next', '/auto-monitor-issue-pr 12'
      ]);

      expect(shell.stdout).toContain('Issue: #12 https://github.com/darthjee/arcanum/issues/12\n');
    });
  });

  describe('an ssh.github.com origin', () => {
    it('maps to github.com URLs on both sides', async () => {
      await execFileAsync('git', [
        '-C', repoPath, 'remote', 'set-url', 'origin', 'ssh://git@ssh.github.com:443/darthjee/arcanum.git'
      ]);

      const { shell } = await assertParity([...BASE, '--issue', '7', '--pr', '8']);

      expect(shell.stdout).toContain('PR: #8 https://github.com/darthjee/arcanum/pull/8\n');
    });
  });

  describe('a non-github https origin', () => {
    it('uses the domain as-is on both sides', async () => {
      await execFileAsync('git', ['-C', repoPath, 'remote', 'set-url', 'origin', 'https://ghe.example.com/org/app.git']);

      await assertParity([...BASE, '--issue', '7']);
    });
  });

  describe('--nested', () => {
    it('matches byte-for-byte', async () => {
      await assertParity([
        ...BASE, '--nested', '--next', '/x', '--issue', '12', '--pr', '13',
        '--sub-issue', '14', '--sub-issue', '15', '--label-change', ':working'
      ]);
    });
  });

  describe('--merge', () => {
    it('fills Issue and PR when the caller did not pass them', async () => {
      await assertParity([...BASE, '--merge', NESTED_BLOCK]);
    });

    it('keeps the caller Issue/PR and appends deduplicated nested data', async () => {
      await assertParity([
        ...BASE,
        '--issue', '1',
        '--pr', '2',
        '--sub-issue', '16',
        '--label-change', 'ready:planning',
        '--merge', NESTED_BLOCK,
        '--merge', 'FINISH_STATUS=declined\nFINISH_SUB_ISSUE=17\nFINISH_SUB_ISSUE=14'
      ]);
    });

    it('merges into a --nested block', async () => {
      await assertParity([...BASE, '--nested', '--merge', NESTED_BLOCK]);
    });

    it('accepts a nested failure when the caller reports failed', async () => {
      await assertParity(['--skill', 's', '--status', 'failed', '--summary', 'x', '--merge', 'FINISH_STATUS=failed\n']);
    });

    it('rejects a nested failure merged into a caller success', async () => {
      await assertParity([...BASE, '--merge', 'FINISH_STATUS=failed\n'], 1);
    });
  });

  describe('usage errors', () => {
    const cases = {
      'a missing --skill': ['--status', 'success', '--summary', 'x'],
      'a missing --status': ['--skill', 's', '--summary', 'x'],
      'a missing --summary': ['--skill', 's', '--status', 'success'],
      'a blank --summary': ['--skill', 's', '--status', 'success', '--summary', '   '],
      'an invalid status': ['--skill', 's', '--status', 'done', '--summary', 'x'],
      'a multi-line summary': ['--skill', 's', '--status', 'success', '--summary', 'one\ntwo'],
      'an unknown flag': [...BASE, '--bogus'],
      'a flag missing its value': [...BASE, '--issue'],
      'a non-numeric --issue': [...BASE, '--issue', 'abc'],
      'a non-numeric --sub-issue': [...BASE, '--sub-issue', '#3'],
      'an unknown tag': [...BASE, '--label-change', 'ready:nope'],
      'a label change with both sides empty': [...BASE, '--label-change', ':'],
      'a label change with no colon': [...BASE, '--label-change', 'ready'],
      'a non-numeric merged issue': [...BASE, '--merge', 'FINISH_ISSUE=abc\n'],
      'an unknown merged tag': [...BASE, '--merge', 'FINISH_LABEL_CHANGE=nope:\n']
    };

    Object.entries(cases).forEach(([description, args]) => {
      it(`exits 1 with empty stdout on both sides for ${description}`, async () => {
        await assertParity(args, 1);
      });
    });

    it('exits 1 on both sides for an empty repo path', async () => {
      const { shell, native } = await runBoth('', BASE, repoPath);

      expectParity(shell, native);
      expect(shell.code).toEqual(1);
    });
  });

  describe('a repo with no origin', () => {
    beforeEach(async () => {
      await execFileAsync('git', ['-C', repoPath, 'remote', 'remove', 'origin']);
    });

    it('fails on both sides when a URL is needed', async () => {
      await assertParity([...BASE, '--issue', '7'], 1);
    });

    it('succeeds on both sides when no URL is needed', async () => {
      await assertParity([...BASE, '--sub-issue', '7']);
    });
  });
});
