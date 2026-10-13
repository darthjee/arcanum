import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  expectDockerParity, expectHostOwned, itWithGhSandbox, runDockerParity, withoutPlatformNotice
} from '../utils/dockerParity.js';
import { git, seedOriginUrl } from '../utils/runCommand.js';
import { TIMEOUT } from './dockerParitySetup.js';

// Shared setup for the opt-in gh parity cases under core/spec/docker/
// (docker batch 3, issue #747): real GitHub calls against the sandbox
// repo named by the ARCANUM_DOCKER_PARITY_GH_* env vars (see
// `GH_SANDBOX_VARS` in dockerParity.js and
// docs/agents/architecture/docker-engine.md#credentials). Local only, and
// only with `ARCANUM_DOCKER_PARITY_GH=1`; pending otherwise. The token
// always comes from the host (`GH_TOKEN`, `GITHUB_TOKEN` or `gh auth
// token`), never from a fixture file, and is never printed.

const execFileAsync = promisify(execFile);

/**
 * The warning `GithubToken#_switchGhUser` prints when `gh auth switch
 * --user <user.ghuser>` fails. Inside the container it always does when
 * the global gitconfig sets `user.ghuser`: `gh` refuses to switch
 * accounts while `GH_TOKEN` (the forwarded host token) is set, and the
 * container has no gh config of its own. The host run switches fine, so
 * this stderr-only line is a known docker divergence (stdout and the
 * exit code are unaffected); it is dropped before comparing stderr.
 */
const GH_SWITCH_WARNING = /^Warning: gh auth switch --user \S+ failed; proceeding with current gh user\n/gm;

/**
 * The env a gh parity case runs both sides with: the world's (an
 * isolated `CLAUDE_CONFIG_DIR`), but with this machine's real `HOME`, so
 * `gh auth token` resolves on the host — natively (core/bin/arcanum's
 * `GithubToken`) and in dispatch's host-side token resolution for the
 * container — plus `GH_TOKEN` / `GITHUB_TOKEN` when the host has them.
 * @param {{env: object}} world - the parity world.
 * @returns {object} the env.
 */
export function ghParityEnv(world) {
  const env = { ...world.env, HOME: process.env.HOME };

  ['GH_TOKEN', 'GITHUB_TOKEN'].forEach((name) => {
    if (process.env[name]) env[name] = process.env[name];
  });

  return env;
}

/**
 * Points the fixture repo's `origin` at the sandbox repo on github.com,
 * so `origin.sh`, `Origin` and `gh` resolve the right host and repo in
 * both runs; with `branch`, also checks out a local branch of that name
 * (for the commands that look a PR up by the current branch).
 * @param {string} repoPath - the fixture repo.
 * @param {string} sandboxRepo - `<owner>/<repo>`.
 * @param {string} [branch] - the branch to check out.
 * @returns {Promise<void>} resolves once wired.
 */
export async function seedSandboxOrigin(repoPath, sandboxRepo, branch) {
  await seedOriginUrl(repoPath, `https://github.com/${sandboxRepo}.git`);
  if (branch) await git(['checkout', '-q', '-b', branch], repoPath);
}

/**
 * @param {string} sandboxRepo - `<owner>/<repo>`.
 * @param {string} issue - the issue number.
 * @returns {Promise<string[]>} the issue's label names, sorted.
 */
export async function issueLabels(sandboxRepo, issue) {
  const { stdout } = await execFileAsync(
    'gh', ['issue', 'view', issue, '-R', sandboxRepo, '--json', 'labels', '-q', '.labels[].name']
  );

  return stdout.split('\n').filter((name) => name.length > 0).sort();
}

/**
 * Puts the issue's labels back to exactly `labels`: adds the missing
 * ones and removes the extra ones in a single `gh issue edit` (none
 * when they already match).
 * @param {string} sandboxRepo - `<owner>/<repo>`.
 * @param {string} issue - the issue number.
 * @param {string[]} labels - the labels to restore.
 * @returns {Promise<void>} resolves once restored.
 */
export async function restoreIssueLabels(sandboxRepo, issue, labels) {
  const current = await issueLabels(sandboxRepo, issue);
  const add = labels.filter((name) => !current.includes(name));
  const remove = current.filter((name) => !labels.includes(name));

  if (add.length === 0 && remove.length === 0) return;

  await execFileAsync('gh', [
    'issue', 'edit', issue, '-R', sandboxRepo,
    ...add.flatMap((name) => ['--add-label', name]),
    ...remove.flatMap((name) => ['--remove-label', name])
  ]);
}

/**
 * Registers one opt-in gh parity case (`itWithGhSandbox`): wires the
 * world's repo to the sandbox (`seedSandboxOrigin`, checking out the PR
 * head branch when `needs` has `prBranch`), runs the real shim's
 * `engine_dispatch` arguments natively and in the parity image, and
 * asserts identical stdout, exit code, stderr (minus Docker's platform
 * notice and the known `gh auth switch` warning) and file diff, with
 * created files host-owned on Linux.
 *
 * With `mutatesLabels`, the sandbox issue's labels are snapshotted
 * first, set to the snapshot plus `startLabels` before each run (so
 * native and docker start from the same labels, as `runDockerParity`
 * restores the tree) and restored to the snapshot in a `finally`,
 * whatever the outcome; the labels each run left behind must match too.
 * @param {string} label - the `it` label.
 * @param {() => {repoPath: string, env: object}} getWorld - the parity world.
 * @param {object} spec - the case.
 * @param {string} spec.command - the dispatched command.
 * @param {string[]} spec.needs - the `GH_SANDBOX_VARS` keys it needs
 *   (`repo` is implied; `issue` too with `mutatesLabels`).
 * @param {(repoPath: string, sandbox: object) => string[]} spec.dispatchArgs -
 *   the shim's real `engine_dispatch` arguments.
 * @param {(repoPath: string, sandbox: object) => Promise<void>} [spec.seed] - fixture setup.
 * @param {(parity: object, repoPath: string, sandbox: object) => Promise<void>|void} [spec.check] -
 *   further expectations (run before the labels are restored).
 * @param {boolean} [spec.mutatesLabels] - whether the command edits the
 *   sandbox issue's labels.
 * @param {string[]} [spec.startLabels] - with `mutatesLabels`, labels
 *   added to the fixture issue before each run (on top of the ones it
 *   had), so a removal has something to remove; they must exist in the
 *   sandbox repo. The final restore drops them again.
 * @returns {void}
 */
export function itMatchesNativeInDockerWithGh(label, getWorld, {
  command, needs, dispatchArgs, seed, check, mutatesLabels = false, startLabels = []
}) {
  const allNeeds = [...new Set(['repo', ...(mutatesLabels ? ['issue'] : []), ...needs])];

  itWithGhSandbox(label, allNeeds, async (sandbox) => {
    const world = getWorld();
    const { repoPath } = world;
    const snapshot = mutatesLabels ? await issueLabels(sandbox.repo, sandbox.issue) : null;
    const restore = mutatesLabels ? () => restoreIssueLabels(sandbox.repo, sandbox.issue, snapshot) : undefined;
    const start = mutatesLabels ? [...new Set([...snapshot, ...startLabels])].sort() : null;
    let nativeLabels = null;

    try {
      await seedSandboxOrigin(repoPath, sandbox.repo, sandbox.prBranch);
      if (seed) await seed(repoPath, sandbox);

      const parity = await runDockerParity({
        command,
        repoPath,
        dispatchArgs: dispatchArgs(repoPath, sandbox),
        env: ghParityEnv(world),
        reset: restore && (async (mode) => {
          if (mode === 'docker') nativeLabels = await issueLabels(sandbox.repo, sandbox.issue);
          await restoreIssueLabels(sandbox.repo, sandbox.issue, start);
        })
      });

      expect(withoutPlatformNotice(parity.docker.stderr).replace(GH_SWITCH_WARNING, ''))
        .toEqual(parity.native.stderr);
      expectDockerParity(parity);
      expectHostOwned(parity);
      if (mutatesLabels) {
        expect(await issueLabels(sandbox.repo, sandbox.issue))
          .withContext('the fixture issue labels after the docker run vs. after the native run')
          .toEqual(nativeLabels);
      }
      if (check) await check(parity, repoPath, sandbox);
    } finally {
      if (restore) await restore();
    }
  }, TIMEOUT);
}
