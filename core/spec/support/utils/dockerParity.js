import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, readdir, readFile, readlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { runEngineDispatch, writeStatusMap } from './engineDispatchLib.js';
import { mergeEngineMode } from './engineMode.js';
import { createTempDir, removeTempDir } from './tempDir.js';

// Helpers for the local-only docker parity suite under core/spec/docker/
// (see docs/agents/specs/docker/testing.md -> "Parity specs (local only)").
// Run through `yarn test:docker` (spec/support/jasmine-docker.json),
// normally via `make docker-parity`; never part of `yarn test`.

const execFileAsync = promisify(execFile);

/**
 * The image under test. Only the parity specs read this env var; they
 * pass it on as the sourced `_ENGINE_DISPATCH_DOCKER_IMAGE` override,
 * never through an env hook in production code.
 */
export const PARITY_IMAGE = process.env.ARCANUM_DOCKER_PARITY_IMAGE || 'darthjee/arcanum:local-test';

/** The prefix of `engine_dispatch`'s "Docker is unavailable" fallback warning. */
const DOCKER_UNAVAILABLE = 'Warning: Docker is unavailable';

/** Entries skipped by `snapshotTree` unless the caller says otherwise. */
const DEFAULT_IGNORE = ['.git'];

/**
 * Registers a `beforeAll` (in the calling `describe`) that fails every
 * case of the suite unless `docker image inspect <PARITY_IMAGE>`
 * succeeds — so a missing image or daemon never passes as parity.
 * @returns {void}
 */
export function requireParityImage() {
  beforeAll(async () => {
    try {
      await execFileAsync('docker', ['image', 'inspect', PARITY_IMAGE]);
    } catch (error) {
      const detail = (error.stderr || error.message || '').trim();

      throw new Error(
        `Docker parity image '${PARITY_IMAGE}' is not available (${detail}). ` +
        'Build it and run the suite with `make docker-parity`.',
        { cause: error }
      );
    }
  });
}

/**
 * Snapshots every file under `root` (recursively, `ignore`d top-level
 * names skipped): a sha256 of its content (or its link target, for a
 * symlink) and, on Linux, its owner uid.
 * @param {string} root - the directory to snapshot.
 * @param {string[]} [ignore] - top-level entry names to skip.
 * @returns {Promise<Map<string, string>>} relative path -> fingerprint.
 */
export async function snapshotTree(root, ignore = DEFAULT_IGNORE) {
  const snapshot = new Map();

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);

      if (dir === root && ignore.includes(entry.name)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      const stats = await lstat(full);
      const content = entry.isSymbolicLink() ? `symlink:${await readlink(full)}` : await readFile(full);
      const hash = createHash('sha256').update(content).digest('hex');
      const owner = process.platform === 'linux' ? ` uid=${stats.uid}` : '';

      snapshot.set(rel, `${hash}${owner}`);
    }
  }

  await walk(root);

  return snapshot;
}

/**
 * Diffs two `snapshotTree` results.
 * @param {Map<string, string>} before - the snapshot before a run.
 * @param {Map<string, string>} after - the snapshot after it.
 * @returns {{changed: object, removed: string[]}} the files created or
 *   changed (relative path -> fingerprint, sorted) and the files removed.
 */
export function diffSnapshots(before, after) {
  const changed = {};
  const removed = [];

  for (const rel of [...after.keys()].sort()) {
    if (before.get(rel) !== after.get(rel)) {
      changed[rel] = after.get(rel);
    }
  }
  for (const rel of [...before.keys()].sort()) {
    if (!after.has(rel)) {
      removed.push(rel);
    }
  }

  return { changed, removed };
}

/**
 * Snapshots each of `dirs`, keyed by the directory itself.
 * @param {string[]} dirs - the directories to snapshot.
 * @param {string[]} ignore - see `snapshotTree`.
 * @returns {Promise<Map<string, Map<string, string>>>} dir -> snapshot.
 */
async function snapshotAll(dirs, ignore) {
  const all = new Map();

  for (const dir of dirs) {
    all.set(dir, await snapshotTree(dir, ignore));
  }

  return all;
}

/**
 * @param {Map<string, Map<string, string>>} before - `snapshotAll` before a run.
 * @param {Map<string, Map<string, string>>} after - `snapshotAll` after it.
 * @returns {object} dir -> `diffSnapshots` result.
 */
function diffAll(before, after) {
  const diff = {};

  for (const [dir, snapshot] of before) {
    diff[dir] = diffSnapshots(snapshot, after.get(dir));
  }

  return diff;
}

/**
 * Runs `engine_dispatch` once in `mode` against a temp status map that
 * marks `command` `"docker"`, and diffs the watched directories.
 * @param {string} mode - `"native"` or `"docker"`.
 * @param {object} options - see `runDockerParity`.
 * @param {string} options.repoPath - the fixture repo.
 * @param {string[]} options.dispatchArgs - `engine_dispatch`'s arguments.
 * @param {string[]} options.argDirs - further watched directories.
 * @param {object} options.env - the run's environment.
 * @param {string[]} options.ignore - see `snapshotTree`.
 * @param {string} statusFile - the temp status map's path.
 * @returns {Promise<{result: object, files: object}>} the run's result
 *   and its file diff.
 */
async function runOnce(mode, { repoPath, dispatchArgs, argDirs, env, ignore, reset }, statusFile) {
  const dirs = [repoPath, ...argDirs];

  if (reset) await reset(mode);
  await mergeEngineMode({ repoPath }, mode);

  const before = await snapshotAll(dirs, ignore);
  const overrides = mode === 'docker' ? { image: PARITY_IMAGE } : {};
  const result = await runEngineDispatch(statusFile, dispatchArgs, repoPath, env, overrides);
  const after = await snapshotAll(dirs, ignore);

  return { result, files: diffAll(before, after) };
}

/**
 * Runs the same `engine_dispatch` call twice — `engine.mode=native`
 * first, then `engine.mode=docker` with the image pinned to
 * `PARITY_IMAGE` — restoring the repo and every argument directory
 * in between, so both runs start from the same tree at the same paths
 * (path identity: no rewriting of stdout). Throws when the docker run
 * fell back with the "Docker is unavailable" warning, so a missing
 * image or daemon never passes as parity.
 * @param {object} options - the run options.
 * @param {string} options.command - the dispatched command (marked
 *   `"docker"` in the temp status map).
 * @param {string} options.repoPath - the fixture repo (the run's cwd).
 * @param {string[]} options.dispatchArgs - `engine_dispatch`'s own
 *   arguments (`<repo_path> <command> <shell_script> [flags...] -- <args...>`).
 * @param {string[]} [options.argDirs] - further directories (argument
 *   paths outside the repo) whose file changes are compared too.
 * @param {object} [options.env] - the environment for both runs.
 * @param {string[]} [options.ignore] - top-level names skipped by the
 *   file diff (defaults to `['.git']`).
 * @param {(mode: string) => Promise<void>} [options.reset] - run before
 *   each run (before its snapshot), to put state outside the watched
 *   directories (e.g. a sandbox issue's GitHub labels) back where the
 *   first run found it.
 * @returns {Promise<{native: object, docker: object, nativeFiles: object, dockerFiles: object}>}
 *   both runs' results and file diffs.
 */
export async function runDockerParity({
  command, repoPath, dispatchArgs, argDirs = [], env = process.env, ignore = DEFAULT_IGNORE, reset
}) {
  const options = { repoPath, dispatchArgs, argDirs, env, ignore, reset };
  const dirs = [repoPath, ...argDirs];
  const work = await createTempDir('arcanum-docker-parity-');

  try {
    const statusFile = await writeStatusMap(work, { [command]: 'docker' });
    const backups = dirs.map((dir, index) => [dir, path.join(work, `backup-${index}`)]);

    for (const [dir, backup] of backups) {
      await cp(dir, backup, { recursive: true, verbatimSymlinks: true });
    }

    const native = await runOnce('native', options, statusFile);

    for (const [dir, backup] of backups) {
      await rm(dir, { recursive: true, force: true });
      await cp(backup, dir, { recursive: true, verbatimSymlinks: true });
    }

    const docker = await runOnce('docker', options, statusFile);

    if (docker.result.stderr.includes(DOCKER_UNAVAILABLE)) {
      throw new Error(
        `The docker run of '${command}' fell back to native instead of running in '${PARITY_IMAGE}': ` +
        `${docker.result.stderr.trim()} (run the suite with \`make docker-parity\`).`
      );
    }

    return { native: native.result, docker: docker.result, nativeFiles: native.files, dockerFiles: docker.files };
  } finally {
    await removeTempDir(work);
  }
}

/**
 * Drops the Docker CLI's own platform-mismatch notice (`WARNING: The
 * requested image's platform ... does not match the detected host
 * platform ...`) from a docker run's stderr. `docker run` prints it
 * when an amd64-only image runs on an arm64 host (e.g. Apple Silicon
 * under emulation); it is not part of the command's output.
 * @param {string} stderr - a run's stderr.
 * @returns {string} stderr without that notice.
 */
export function withoutPlatformNotice(stderr) {
  return stderr
    .split(/(?<=\n)/)
    .filter((line) => !line.startsWith('WARNING: The requested image\'s platform'))
    .join('');
}

/**
 * Asserts a `runDockerParity` result: byte-identical stdout, the same
 * exit code, and the same files created/changed/removed (content, and
 * owner uid on Linux).
 * @param {{native: object, docker: object, nativeFiles: object, dockerFiles: object}} parity -
 *   the `runDockerParity` result.
 * @returns {void}
 */
export function expectDockerParity({ native, docker, nativeFiles, dockerFiles }) {
  expect(docker.stdout).toEqual(native.stdout);
  expect(docker.code).toEqual(native.code);
  expect(dockerFiles).toEqual(nativeFiles);
}

/**
 * Builds an opt-in `it` wrapper gated on `envVar=1`.
 * @param {string} envVar - the gating env var.
 * @param {string} reason - what the case needs, for the pending message.
 * @returns {(description: string, fn: () => Promise<void>, timeout?: number) => void}
 *   an `it(description, fn)` replacement.
 */
function gatedIt(envVar, reason) {
  return (description, fn, timeout) => it(description, async function() {
    if (process.env[envVar] !== '1') {
      pending(`set ${envVar}=1 to run (${reason})`);

      return;
    }

    await fn.call(this);
  }, timeout);
}

/** `it` that runs only when `ARCANUM_DOCKER_PARITY_GH=1` (a host gh token and a sandbox repo). */
export const itWithGh = gatedIt('ARCANUM_DOCKER_PARITY_GH', 'needs a gh token resolvable on the host and a sandbox repo');

/**
 * The gh sandbox the opt-in gh cases run against, one env var per
 * fixture (see docs/agents/specs/docker/testing.md -> "Credentials"),
 * each with the format it must match and what it must point to.
 */
export const GH_SANDBOX_VARS = {
  repo: {
    name: 'ARCANUM_DOCKER_PARITY_GH_REPO',
    pattern: /^[\w.-]+\/[\w.-]+$/,
    what: 'the sandbox repo on github.com, as <owner>/<repo>'
  },
  issue: {
    name: 'ARCANUM_DOCKER_PARITY_GH_ISSUE',
    pattern: /^[1-9][0-9]*$/,
    what: 'an open fixture issue number in the sandbox repo whose labels the cases may toggle'
  },
  pr: {
    name: 'ARCANUM_DOCKER_PARITY_GH_PR',
    pattern: /^[1-9][0-9]*$/,
    what: 'an open fixture pull request number in the sandbox repo'
  },
  prBranch: {
    name: 'ARCANUM_DOCKER_PARITY_GH_PR_BRANCH',
    pattern: /^[^\s]+$/,
    what: 'the head branch of ARCANUM_DOCKER_PARITY_GH_PR'
  }
};

/**
 * Reads the gh sandbox fixtures a case needs from the environment.
 * @param {string[]} needs - `GH_SANDBOX_VARS` keys (e.g. `['repo', 'issue']`).
 * @param {object} [env] - the environment to read (default `process.env`).
 * @returns {{sandbox: object|null, problems: string[]}} the values by key,
 *   or `null` plus one message per missing or malformed var.
 */
export function readGhSandbox(needs, env = process.env) {
  const sandbox = {};
  const problems = [];

  needs.forEach((key) => {
    const { name, pattern, what } = GH_SANDBOX_VARS[key];
    const value = env[name];

    if (!value) {
      problems.push(`set ${name} (${what})`);
    } else if (!pattern.test(value)) {
      problems.push(`${name}='${value}' is not ${what}`);
    } else {
      sandbox[key] = value;
    }
  });

  return { sandbox: problems.length === 0 ? sandbox : null, problems };
}

/**
 * `itWithGh`, plus the gh sandbox fixtures: when a var in `needs` is
 * missing or malformed the case is pending, with a message naming it —
 * never failed. `fn` gets the sandbox values (`readGhSandbox`).
 * @param {string} description - the `it` label.
 * @param {string[]} needs - the `GH_SANDBOX_VARS` keys the case needs.
 * @param {(sandbox: object) => Promise<void>} fn - the case body.
 * @param {number} [timeout] - the case timeout.
 * @returns {void}
 */
export function itWithGhSandbox(description, needs, fn, timeout) {
  itWithGh(description, async function() {
    const { sandbox, problems } = readGhSandbox(needs);

    if (!sandbox) {
      pending(`gh sandbox not configured: ${problems.join('; ')}`);

      return;
    }

    await fn.call(this, sandbox);
  }, timeout);
}

/** `it` that runs only when `ARCANUM_DOCKER_PARITY_SSH=1` (an ssh agent and an ssh remote). */
export const itWithSsh = gatedIt('ARCANUM_DOCKER_PARITY_SSH', 'needs an ssh agent and an ssh remote');



/**
 * On Linux, asserts every file the docker run created or changed is
 * owned by the host uid (`snapshotTree` fingerprints end with
 * ` uid=<n>` there). A no-op elsewhere: Docker Desktop maps ownership
 * on macOS, so `snapshotTree` records no uid.
 * @param {{dockerFiles: object}} parity - a `runDockerParity` result.
 * @returns {void}
 */
export function expectHostOwned({ dockerFiles }) {
  if (process.platform !== 'linux') return;

  Object.values(dockerFiles).forEach(({ changed }) => {
    Object.entries(changed).forEach(([file, fingerprint]) => {
      expect(fingerprint.endsWith(` uid=${process.getuid()}`)).withContext(file).toBeTrue();
    });
  });
}
