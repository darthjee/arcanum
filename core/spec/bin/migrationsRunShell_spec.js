import { execFile } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for arcanum/migrations/run.sh's interactive form (issue
// #682). This is NOT a parity spec: the script has no native counterpart.
// It pins the "TTY-first with AskUserQuestion fallback" contract from
// docs/agents/plans/682-*/plan.md's "Shared contracts": when versions are
// pending and the TTY device cannot be opened, run.sh prints only
// `FALLBACK=chat`, `CURRENT=`, `LOCAL=`, `GLOBAL=` and one `PENDING=` line
// per pending version (ascending), exits 4 and does not reset the errors
// file. When nothing is pending it prints "Up to date" and exits 0 even with
// no TTY, and a bad `--repo` exits 1 with empty stdout before any TTY probe.
// The test-only `ARCANUM_TTY_DEVICE` override points the TTY at a path that
// doesn't exist to simulate "no TTY"; `CLAUDE_CONFIG_DIR` points the global
// config at a temp dir so the real home config is never touched. The
// interactive TTY paths ([A]ll/[N]one/[S]elect/[C]hat) are out of scope.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'arcanum', 'migrations', 'run.sh');

/**
 * Run migrations/run.sh with a non-existent TTY device and an isolated
 * global config dir, capturing stdout/stderr/exit code.
 * @param {string[]} args - the CLI arguments to pass to the script.
 * @param {string} tempDir - the spec's temp dir (hosts the fake TTY path and config dir).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runMigrations(args, tempDir) {
  try {
    const { stdout, stderr } = await execFileAsync(SCRIPT, args, {
      env: {
        ...process.env,
        ARCANUM_TTY_DEVICE: path.join(tempDir, 'missing-tty'),
        CLAUDE_CONFIG_DIR: path.join(tempDir, 'claude')
      }
    });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * Compare two `x.y.z` semver strings numerically.
 * @param {string} a - the first version.
 * @param {string} b - the second version.
 * @returns {number} negative, zero or positive, like a sort comparator.
 */
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }

  return 0;
}

/**
 * Write a JSON fixture file, creating its parent directory if needed.
 * @param {string} file - the absolute file path.
 * @param {object} content - the JSON content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeJson(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(content)}\n`);
}

/**
 * Check whether a path exists.
 * @param {string} file - the path to check.
 * @returns {Promise<boolean>} true if it exists.
 */
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe('arcanum/migrations/run.sh interactive form (no TTY available)', () => {
  let tempDir;
  let repo;

  beforeEach(async () => {
    tempDir = await createTempDir();
    repo = path.join(tempDir, 'repo');
    await mkdir(repo);
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  describe('with pending versions', () => {
    let result;
    let lines;

    beforeEach(async () => {
      result = await runMigrations(['--repo', repo], tempDir);
      lines = result.stdout.split('\n').filter((line) => line !== '');
    });

    it('exits 4', () => {
      expect(result.code).toBe(4);
    });

    it('prints FALLBACK=chat as the first line', () => {
      expect(lines[0]).toBe('FALLBACK=chat');
    });

    it('prints the three resolved version pointers', () => {
      expect(lines).toContain('CURRENT=0.0.0');
      expect(lines).toContain('LOCAL=0.0.0');
      expect(lines).toContain('GLOBAL=0.0.0');
    });

    it('prints only machine-readable lines', () => {
      lines.forEach((line) => {
        expect(line).toMatch(/^(FALLBACK|CURRENT|LOCAL|GLOBAL|PENDING)=/);
      });
    });

    it('prints at least one PENDING= line, in ascending order', () => {
      const pending = lines
        .filter((line) => line.startsWith('PENDING='))
        .map((line) => line.slice('PENDING='.length));

      expect(pending.length).toBeGreaterThan(0);
      expect(pending).toEqual([...pending].sort(compareSemver));
    });

    it('does not create/reset the errors file', async () => {
      const errorsFile = path.join(repo, '.claude', 'state', 'arcanum-errors.json');

      expect(await exists(errorsFile)).toBe(false);
    });
  });

  describe('when up to date', () => {
    beforeEach(async () => {
      await writeJson(
        path.join(repo, '.claude', 'configuration', 'arcanum-repo-config.json'),
        { version: '999.0.0' }
      );
      await writeJson(
        path.join(repo, '.claude', 'state', 'arcanum-config.json'),
        { migrations: { version: '999.0.0' } }
      );
      await writeJson(
        path.join(tempDir, 'claude', 'arcanum-config.json'),
        { migrations: { version: '999.0.0' } }
      );
    });

    it('prints "Up to date" and exits 0 without a fallback', async () => {
      const result = await runMigrations(['--repo', repo], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Up to date');
      expect(result.stdout).not.toContain('FALLBACK=');
    });
  });

  describe('when --repo is not a directory (validated before the TTY probe)', () => {
    it('exits 1 with empty stdout', async () => {
      const result = await runMigrations(['--repo', path.join(tempDir, 'nope')], tempDir);

      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
    });
  });
});
