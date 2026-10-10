import path from 'node:path';
import {
  describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import { requireParityImage } from '../support/utils/dockerParity.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'init-claude', 'scripts');
const REPO_CONFIG = '.claude/configuration/arcanum-repo-config.json';

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
// and init-claude-setup-templates (docker batch 1, #745). The templates
// case compares native's host copy of init-claude/templates with the
// image's baked copy: a mismatch there means a stale image.
describe('init-claude commands docker parity', () => {
  requireParityImage();

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
});
