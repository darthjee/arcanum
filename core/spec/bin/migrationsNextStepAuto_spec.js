import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const execFileAsync = promisify(execFile);

// Contract spec for the `next/001`–`003` repo migrations that offer to
// seed the `next_step.auto.<skill>` keys in the local, repo and global
// config tiers (issue #716). NOT a parity spec: the migration scripts
// have no native counterpart. Their interactive path reads `/dev/tty`,
// so every `run` here is spawned `detached` (a new session via
// setsid(2), with no controlling terminal), which makes `/dev/tty`
// unopenable — the "no TTY" branch under test. A sanity case asserts
// that this detachment really does hide `/dev/tty`.
//
// Some environments (e.g. the CI Docker container) still let a detached
// process open `/dev/tty`. A `beforeAll` probe (which only opens the
// device, never reads from it, so it cannot block) detects that; when
// `/dev/tty` is openable the sanity and `run` cases are marked pending
// rather than run, since the scripts would block prompting on it. The
// `config` and unknown-subcommand cases always run.

const MIGRATIONS_DIR = path.join(REPO_ROOT, 'arcanum', 'migrations', 'repos', 'next');
const SCRIPTS = ['001', '002', '003'].map((id) => [id, path.join(MIGRATIONS_DIR, `${id}.sh`)]);
const TTY_PROBE = ['bash', '-c', 'if ( exec 3< /dev/tty ) 2>/dev/null; then echo open; else echo closed; fi'];
const TTY_PENDING_REASON =
  'a detached process can still open /dev/tty in this environment, so the no-TTY branch cannot be exercised';

/**
 * Run a command in a new session, without a controlling terminal, with
 * stdin closed.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} env - the environment to run the command with.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
 */
async function runDetached([file, ...args], cwd, env) {
  const pending = execFileAsync(file, args, { cwd, env, detached: true });

  pending.child.stdin.end();

  try {
    const { stdout, stderr } = await pending;

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * @param {string} dir - a directory.
 * @returns {Promise<string[]>} every file under `dir`, relative to it.
 */
async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)));
}

describe('next/ auto-next migrations', () => {
  let ttyHidden;
  let repoPath;
  let homeDir;
  let configDir;
  let env;

  beforeAll(async () => {
    const probeDir = await createTempDir('arcanum-core-next-step-migration-probe-');

    try {
      const result = await runDetached(TTY_PROBE, probeDir, { PATH: process.env.PATH });

      ttyHidden = result.stdout === 'closed\n';
    } finally {
      await removeTempDir(probeDir);
    }
  });

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-next-step-migration-repo-');
    homeDir = await createTempDir('arcanum-core-next-step-migration-home-');
    configDir = await createTempDir('arcanum-core-next-step-migration-global-');
    env = { PATH: process.env.PATH, HOME: homeDir, CLAUDE_CONFIG_DIR: configDir };
  });

  afterEach(async () => {
    await Promise.all([removeTempDir(repoPath), removeTempDir(homeDir), removeTempDir(configDir)]);
  });

  it('runs detached processes without an openable /dev/tty', async () => {
    if (!ttyHidden) {
      pending(TTY_PENDING_REASON);
    }

    const result = await runDetached(TTY_PROBE, repoPath, env);

    expect(result.stdout).toEqual('closed\n');
  });

  SCRIPTS.forEach(([id, script]) => {
    it(`${id}.sh config prints {"skippable": true}`, async () => {
      const result = await runDetached([script, 'config'], repoPath, env);

      expect(result).toEqual({ stdout: '{"skippable": true}\n', stderr: '', code: 0 });
    });

    it(`${id}.sh run without a TTY writes nothing and exits 0`, async () => {
      if (!ttyHidden) {
        pending(TTY_PENDING_REASON);
      }

      const result = await runDetached([script, 'run'], repoPath, env);

      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(await listFiles(repoPath)).toEqual([]);
      expect(await listFiles(homeDir)).toEqual([]);
      expect(await listFiles(configDir)).toEqual([]);
    });

    it(`${id}.sh rejects an unknown subcommand`, async () => {
      const result = await runDetached([script, 'bogus'], repoPath, env);

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain('Usage:');
    });
  });
});
