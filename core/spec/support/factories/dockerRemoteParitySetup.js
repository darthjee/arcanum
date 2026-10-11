import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expectDockerParity, expectHostOwned, itWithSsh, runDockerParity, withoutPlatformNotice
} from '../utils/dockerParity.js';
import { git, runCommand, seedOriginUrl } from '../utils/runCommand.js';
import { TIMEOUT } from './dockerParitySetup.js';

// Shared setup for the git remote parity cases under core/spec/docker/
// (docker batch 4, issue #748). The default cases need no credentials:
// the fixture repo's `origin` is a bare repo kept inside its own git dir
// (`<git-common-dir>/arcanum-parity-origin.git`, a `file://` URL), so
// the container reaches it through the repo mount (or, from a worktree,
// the git common dir mount) and every `make docker-parity` run compares
// real fetch/push behavior. The real ssh transport is covered by the
// opt-in `itMatchesNativeInDockerWithSsh` (see
// docs/agents/specs/docker/testing.md -> "Credentials"). Local only,
// never part of `yarn test`.

/** The bare origin's directory name, inside the fixture's git common dir. */
export const PARITY_ORIGIN_DIR = 'arcanum-parity-origin.git';

/** The commit identity the remote cases' `HOME/.gitconfig` carries. */
const PARITY_GITCONFIG = '[user]\n\tname = Parity\n\temail = parity@example.com\n';

/**
 * @param {string[]} args - the `git` arguments.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<string>} their stdout.
 */
async function gitOutput(args, cwd) {
  return (await runCommand(['git', ...args], cwd)).stdout;
}

/**
 * Replaces every abbreviated or full commit hash in `text` (a word of
 * 7-40 lowercase hex digits) with `<hash>`: `git commit`'s `[branch
 * <hash>]` summary and `git push`'s `<old>..<new>` range differ between
 * the native and docker runs, whose commits are made at different times.
 * @param {string} text - a run's stdout or stderr.
 * @returns {string} `text` with commit hashes masked.
 */
export function maskCommitHashes(text) {
  return text.replace(/\b[0-9a-f]{7,40}\b/g, '<hash>');
}

/**
 * Moves the fixture repo's `origin` into its own git dir: a bare clone
 * of the current origin at `<git-common-dir>/arcanum-parity-origin.git`,
 * set as `origin` with a `file://` URL and fetched, so the container
 * reaches it through the mounts the repo already gets.
 * @param {string} repoPath - the fixture repo (or worktree).
 * @returns {Promise<{origin: string, commonDir: string}>} the bare
 *   origin's path and the git common dir holding it.
 */
export async function seedLocalOrigin(repoPath) {
  const commonDir = (await gitOutput(['rev-parse', '--path-format=absolute', '--git-common-dir'], repoPath)).trim();
  const currentOrigin = (await gitOutput(['remote', 'get-url', 'origin'], repoPath)).trim();
  const origin = path.join(commonDir, PARITY_ORIGIN_DIR);

  await git(['clone', '--quiet', '--bare', currentOrigin, origin], repoPath);
  await seedOriginUrl(repoPath, `file://${origin}`);
  await git(['fetch', '--quiet', 'origin'], repoPath);

  return { origin, commonDir };
}

/**
 * @param {string} origin - a bare repo.
 * @returns {Promise<string>} its branches, one `<ref> <subject>` line
 *   each (subjects, not hashes, so runs at different times compare).
 */
export async function originBranches(origin) {
  return gitOutput(['for-each-ref', '--format=%(refname) %(subject)', 'refs/heads'], origin);
}

/**
 * Writes the world's `HOME/.gitconfig` with a commit identity, so the
 * commands that commit find one natively (they allowlist `HOME`) and in
 * the container (their `gitconfig` need mounts it).
 * @param {{env: {HOME: string}}} world - the parity world.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedParityGitconfig(world) {
  await writeFile(path.join(world.env.HOME, '.gitconfig'), PARITY_GITCONFIG);
}

/**
 * Registers one git remote parity case (docker batch 4): moves the
 * world's `origin` into its git dir (`seedLocalOrigin`), writes the
 * `HOME/.gitconfig` identity, seeds, then runs the real shim's
 * `engine_dispatch` arguments natively and in the parity image and
 * asserts identical stdout, exit code, stderr (minus Docker's platform
 * notice), file diff (created files host-owned on Linux) and origin
 * branches after each run. With `masksHashes`, commit hashes are masked
 * in stdout and stderr first (`maskCommitHashes`).
 *
 * From a worktree, the git common dir (HEAD, index, refs and the
 * origin) lives in the main clone, outside the repo, so that clone is
 * watched too (`argDirs`): `runDockerParity` restores it between runs,
 * and the docker run starts from the git state the native run found.
 * @param {string} label - the `it` label.
 * @param {() => {repoPath: string, env: object}} getWorld - the parity world.
 * @param {object} spec - the case.
 * @param {string} spec.command - the dispatched command.
 * @param {(repoPath: string, world: object) => string[]} spec.dispatchArgs - the shim's
 *   real `engine_dispatch` arguments.
 * @param {(repoPath: string, world: object) => Promise<void>} [spec.seed] - fixture setup,
 *   after `origin` is moved (push to it to seed remote branches).
 * @param {(parity: object, repoPath: string, world: object) => Promise<void>|void} [spec.check] -
 *   further expectations (`parity.nativeInspected` holds the origin's
 *   branches after the native run).
 * @param {boolean} [spec.masksHashes] - mask commit hashes before comparing.
 * @returns {void}
 */
export function itMatchesNativeInDockerWithRemote(label, getWorld, {
  command, dispatchArgs, seed, check, masksHashes = false
}) {
  it(label, async () => {
    const world = getWorld();
    const { repoPath, env } = world;
    const { origin, commonDir } = await seedLocalOrigin(repoPath);
    const mainClone = path.dirname(commonDir);
    const argDirs = mainClone === repoPath ? [] : [mainClone];
    const mask = masksHashes ? maskCommitHashes : (text) => text;

    await seedParityGitconfig(world);
    if (seed) await seed(repoPath, world);

    const parity = await runDockerParity({
      command,
      repoPath,
      dispatchArgs: dispatchArgs(repoPath, world),
      argDirs,
      env,
      inspect: () => originBranches(origin)
    });

    expect(mask(withoutPlatformNotice(parity.docker.stderr))).toEqual(mask(parity.native.stderr));
    expectDockerParity({
      ...parity,
      native: { ...parity.native, stdout: mask(parity.native.stdout) },
      docker: { ...parity.docker, stdout: mask(parity.docker.stdout) }
    });
    expectHostOwned(parity);
    expect(parity.dockerInspected).withContext('origin branches after docker vs. native').toEqual(parity.nativeInspected);
    if (check) await check(parity, repoPath, world);
  }, TIMEOUT);
}

/**
 * The ssh remote the opt-in ssh cases fetch from (read-only), from
 * `ARCANUM_DOCKER_PARITY_SSH_REMOTE`; `null` when unset or not
 * ssh-shaped (`git@host:path` or `ssh://...`).
 * @param {object} [env] - the environment to read (default `process.env`).
 * @returns {string|null} the remote URL.
 */
export function sshParityRemote(env = process.env) {
  const url = env.ARCANUM_DOCKER_PARITY_SSH_REMOTE || '';

  return /^(git@[^:\s]+:\S+|ssh:\/\/\S+)$/.test(url) ? url : null;
}

/**
 * Registers one opt-in ssh parity case (`itWithSsh`, so pending unless
 * `ARCANUM_DOCKER_PARITY_SSH=1`; also pending, naming the var, when
 * `ARCANUM_DOCKER_PARITY_SSH_REMOTE` is unset or not ssh-shaped): points
 * the world's `origin` at that remote and compares a read-only command
 * natively and in the parity image, like `itMatchesNativeInDockerWithRemote`
 * minus the origin inspection. Both runs keep this machine's real
 * `HOME` (for `~/.ssh/known_hosts` and keys) and `SSH_AUTH_SOCK` (the
 * container gets the agent through the `remote` need), with
 * `CLAUDE_CONFIG_DIR` still isolated.
 * @param {string} label - the `it` label.
 * @param {() => {repoPath: string, env: object}} getWorld - the parity world.
 * @param {object} spec - the case.
 * @param {string} spec.command - the dispatched command.
 * @param {(repoPath: string) => string[]} spec.dispatchArgs - the shim's
 *   real `engine_dispatch` arguments.
 * @param {(parity: object, repoPath: string) => Promise<void>|void} [spec.check] -
 *   further expectations.
 * @returns {void}
 */
export function itMatchesNativeInDockerWithSsh(label, getWorld, { command, dispatchArgs, check }) {
  itWithSsh(label, async () => {
    const remote = sshParityRemote();

    if (!remote) {
      pending('set ARCANUM_DOCKER_PARITY_SSH_REMOTE to a read-only ssh remote (git@host:owner/repo.git)');

      return;
    }

    const world = getWorld();
    const { repoPath } = world;
    const env = { ...world.env, HOME: process.env.HOME };

    if (process.env.SSH_AUTH_SOCK) env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
    await seedOriginUrl(repoPath, remote);

    const parity = await runDockerParity({ command, repoPath, dispatchArgs: dispatchArgs(repoPath), env });

    expect(withoutPlatformNotice(parity.docker.stderr)).toEqual(parity.native.stderr);
    expectDockerParity(parity);
    expectHostOwned(parity);
    if (check) await check(parity, repoPath);
  }, TIMEOUT);
}
