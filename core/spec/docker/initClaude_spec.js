import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import InstallVersion from '../../lib/utils/file/InstallVersion.js';
import {
  TIMEOUT, describeParityRepos, itMatchesNativeInDocker, nativeOutsideWrites, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import {
  PARITY_IMAGE, requireParityImage, runDockerParity, withoutPlatformNotice
} from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const execFileAsync = promisify(execFile);

const SCRIPTS_DIR = path.join(REPO_ROOT, 'init-claude', 'scripts');
const REPO_CONFIG = '.claude/configuration/arcanum-repo-config.json';
const LOCAL_CONFIG = '.claude/state/arcanum-config.json';
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const STAMP = 'init-claude-stamp-arcanum-version';
const LABEL_CASES = [
  { sub: 'replace', items: ['A:111111', 'B:222222'] },
  { sub: 'remove', items: ['Old'] },
  { sub: 'add', items: ['New:444444'] }
];

/**
 * @param {string} version - a resolved install version.
 * @returns {string} the version stamp_arcanum_version writes for it:
 *   itself when semver, `''` (a silent no-op) otherwise.
 */
function stampOf(version) {
  return SEMVER.test(version) ? version : '';
}

/**
 * @param {{changed: object, removed: string[]}} diff - one dir's file diff.
 * @returns {{changed: object, removed: string[]}} it without the local
 *   config (`LOCAL_CONFIG`).
 */
function withoutLocalConfig({ changed, removed }) {
  const rest = Object.fromEntries(Object.entries(changed).filter(([file]) => file !== LOCAL_CONFIG));

  return { changed: rest, removed };
}

/**
 * @returns {Promise<string>} the version baked into `PARITY_IMAGE`'s
 *   `/opt/arcanum/arcanum.json` (its `ARCANUM_VERSION` build arg).
 */
async function imageVersion() {
  const { stdout } = await execFileAsync(
    'docker', ['run', '--rm', '--entrypoint', 'cat', PARITY_IMAGE, '/opt/arcanum/arcanum.json']
  );

  return JSON.parse(stdout).version;
}

/**
 * The real init-claude setup shims' `engine_dispatch` call
 * (`--prepend-repo-path`, the shim's cwd as the repo).
 * @param {string} command - the dispatched command.
 * @param {string} shellScript - the shell twin's file name.
 * @param {...string} args - the shim's arguments.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function setupDispatch(command, shellScript, ...args) {
  return (repoPath) => [
    repoPath, command, path.join(SCRIPTS_DIR, shellScript), '--prepend-repo-path', '--', ...args
  ];
}

// Local-only parity cases for init-claude-set-ci-ignored-patterns,
// init-claude-set-next-step-auto (native-only), init-claude-setup-docs-structure
// and init-claude-setup-templates (docker batch 1, #745), plus
// init-claude-write-label-config-{add,remove,replace} and
// init-claude-stamp-arcanum-version (docker batch 2, #746). The
// templates case compares native's host copy of init-claude/templates
// with the image's baked copy: a mismatch there means a stale image.
//
// stamp-arcanum-version resolves the install's version on each side:
// natively from this checkout (exact git tag, else nothing), in docker
// from the image's arcanum.json. Those agree whenever the image is the
// one dispatch would pick for this install (`darthjee/arcanum:<tag>` on
// a release tag, `:local-<sha>` otherwise — a non-semver no-op on both
// sides). `make docker-parity`'s image is built with ARCANUM_VERSION from
// arcanum.version, so on a dev install between tags the two sides
// differ: the strict parity case is then pending, and a second case
// pins the divergence (docker stamps the image's version, native
// doesn't) so it is never silently hidden.
describe('init-claude commands docker parity', () => {
  requireParityImage();

  let hostStamp;
  let imageStamp;

  beforeAll(async () => {
    hostStamp = stampOf(await new InstallVersion().resolve(REPO_ROOT));
    imageStamp = stampOf(await imageVersion());
  }, TIMEOUT);

  describeParityRepos('set-next-step-auto (native-only)', (getWorld) => {
    itMatchesNativeInDocker('writes next_step.auto.<skill>', getWorld, {
      command: 'init-claude-set-next-step-auto',
      dispatchArgs: (repoPath) => [
        repoPath, 'init-claude-set-next-step-auto', '', '--native-only', '--', repoPath, 'enhance-issue', 'true'
      ],
      check: (parity, repoPath) => {
        expect(parity.native.stdout).toEqual('NEXT_STEP_AUTO=enhance-issue=true\n');
        expect(nativeWrites(parity, repoPath)).toEqual([REPO_CONFIG]);
      }
    });

    itMatchesNativeInDocker('rejects an unknown skill', getWorld, {
      command: 'init-claude-set-next-step-auto',
      dispatchArgs: (repoPath) => [
        repoPath, 'init-claude-set-next-step-auto', '', '--native-only', '--', repoPath, 'nope', 'true'
      ],
      check: ({ native }) => expect(native.code).toEqual(1)
    });
  }, { worktree: true });

  describeParityRepos('set-ci-ignored-patterns, setup-docs-structure and setup-templates', (getWorld) => {
    itMatchesNativeInDocker('set-ci-ignored-patterns writes the patterns', getWorld, {
      command: 'init-claude-set-ci-ignored-patterns',
      dispatchArgs: setupDispatch(
        'init-claude-set-ci-ignored-patterns', 'set_ci_ignored_patterns_shell.sh', 'codacy*', 'lint'
      ),
      check: (parity, repoPath) => expect(nativeWrites(parity, repoPath)).toEqual([REPO_CONFIG])
    });

    itMatchesNativeInDocker('set-ci-ignored-patterns --clear writes an empty list', getWorld, {
      command: 'init-claude-set-ci-ignored-patterns',
      dispatchArgs: setupDispatch('init-claude-set-ci-ignored-patterns', 'set_ci_ignored_patterns_shell.sh', '--clear'),
      check: (parity, repoPath) => expect(nativeWrites(parity, repoPath)).toEqual([REPO_CONFIG])
    });

    itMatchesNativeInDocker('setup-docs-structure creates docs/agents and appends to AGENTS.md', getWorld, {
      command: 'init-claude-setup-docs-structure',
      dispatchArgs: setupDispatch('init-claude-setup-docs-structure', 'setup_docs_structure_shell.sh'),
      seed: (repoPath) => seedRepoFile(repoPath, 'AGENTS.md', '# Agents\n'),
      check: (parity, repoPath) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath)).toContain('AGENTS.md');
        expect(nativeWrites(parity, repoPath)).toContain('docs/agents/flow.md');
      }
    });

    itMatchesNativeInDocker('setup-templates copies the templates', getWorld, {
      command: 'init-claude-setup-templates',
      dispatchArgs: setupDispatch('init-claude-setup-templates', 'setup_templates_shell.sh'),
      check: (parity, repoPath) => {
        expect(parity.native.code).toEqual(0);
        expect(nativeWrites(parity, repoPath)).toContain('.github/pull_request_template.md');
      }
    });
  });

  describeParityRepos('write-label-config', (getWorld) => {
    LABEL_CASES.forEach(({ sub, items }) => {
      const command = `init-claude-write-label-config-${sub}`;

      itMatchesNativeInDocker(`${sub} rewrites a config file outside the repo`, getWorld, {
        command,
        seed: (_repoPath, { outsideDir }) => writeFile(
          path.join(outsideDir, 'labels.json'),
          '{"labels":[{"name":"Old","color":"000000"},{"name":"Keep","color":"333333"}]}'
        ),
        dispatchArgs: (repoPath, { outsideDir }) => [
          repoPath, command, path.join(SCRIPTS_DIR, `write_label_config_${sub}_shell.sh`),
          '--prepend-repo-path', '--path-arg=1:rw', '--', path.join(outsideDir, 'labels.json'), ...items
        ],
        watchOutside: true,
        check: (parity, repoPath, { outsideDir }) => {
          expect(parity.native).toEqual({ stdout: '', stderr: '', code: 0 });
          expect(nativeOutsideWrites(parity, outsideDir)).toEqual(['labels.json']);
          expect(nativeWrites(parity, repoPath)).toEqual([]);
        }
      });
    });
  }, { worktree: true });

  describeParityRepos('stamp-arcanum-version (with a global arcanum-config.json)', (getWorld) => {
    /**
     * Seeds the repo and global configs, then runs the stamp's real
     * `engine_dispatch` call natively and in docker.
     * @returns {Promise<{parity: object, repoPath: string}>} the parity result.
     */
    async function runStamp() {
      const { repoPath, configDir, env } = getWorld();

      await writeFile(path.join(configDir, 'arcanum-config.json'), '{"git":{"safe_branch":"origin/main"}}');
      await seedRepoFile(repoPath, REPO_CONFIG, '{"version":"0.1.0","auto-fix-all":{"x":1}}\n');

      const parity = await runDockerParity({
        command: STAMP,
        repoPath,
        dispatchArgs: [
          repoPath, STAMP, path.join(SCRIPTS_DIR, 'stamp_arcanum_version_shell.sh'),
          '--prepend-repo-path', '--needs=global-config', 'HOME', '--'
        ],
        env
      });

      return { parity, repoPath };
    }

    it('stamps the same version as native when the image matches the install', async () => {
      if (hostStamp !== imageStamp) {
        pending(`the install resolves '${hostStamp}' but ${PARITY_IMAGE} carries '${imageStamp}' ` +
          '(a dev install between tags): see the divergence case');

        return;
      }

      const { parity, repoPath } = await runStamp();
      const local = JSON.parse(await readFile(path.join(repoPath, LOCAL_CONFIG), 'utf8'));

      expect(withoutPlatformNotice(parity.docker.stderr)).toEqual(parity.native.stderr);
      expect(parity.native).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(parity.docker.stdout).toEqual(parity.native.stdout);
      expect(parity.docker.code).toEqual(parity.native.code);
      // The local config also carries the harness's own engine.mode
      // (native vs docker), so it is compared by its stamp, not its hash.
      expect(withoutLocalConfig(parity.dockerFiles[repoPath])).toEqual(withoutLocalConfig(parity.nativeFiles[repoPath]));
      expect(nativeWrites(parity, repoPath)).toEqual(hostStamp ? [REPO_CONFIG] : []);
      expect(local.migrations?.version).toEqual(hostStamp || undefined);
    }, TIMEOUT);

    it('diverges from native only in the stamped version when the image does not match the install', async () => {
      if (hostStamp === imageStamp) {
        pending(`the install and ${PARITY_IMAGE} both resolve '${hostStamp}': no divergence to pin`);

        return;
      }

      const { parity, repoPath } = await runStamp();
      const dockerWrites = Object.keys(parity.dockerFiles[repoPath].changed);
      const { version } = JSON.parse(await readFile(path.join(repoPath, REPO_CONFIG), 'utf8'));

      expect(parity.docker.stdout).toEqual(parity.native.stdout);
      expect(parity.docker.code).toEqual(parity.native.code);
      expect(nativeWrites(parity, repoPath).includes(REPO_CONFIG)).toEqual(hostStamp !== '');
      expect(dockerWrites.includes(REPO_CONFIG)).toEqual(imageStamp !== '');
      expect(version).toEqual(imageStamp || '0.1.0');
    }, TIMEOUT);
  });
});
