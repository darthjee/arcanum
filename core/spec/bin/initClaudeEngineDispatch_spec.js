import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InstallVersion from '../../lib/utils/file/InstallVersion.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'init-claude', 'scripts');
const TEMPLATES = ['pull_request_template.md', 'commit_message_template.md', 'commit_message_template-2.0.md'];
const DOCS_FILES = [
  'docs/agents/issues/.gitkeep',
  'docs/agents/plans/.gitkeep',
  'docs/agents/architecture.md',
  'docs/agents/flow.md',
  'docs/agents/issue-enhancement.md',
  'docs/agents/arcanum-split-issue.md'
];

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * Expects `stamp_arcanum_version.sh`'s result: no output, exit 0, and
 * the repo config stamped with the install's version only when that is
 * a release tag (a dev install between tags, `local-<sha>`, is a
 * silent no-op).
 * @param {object} result - the shim's result.
 * @param {{repoPath: string}} ctx - the case context.
 * @returns {Promise<void>} resolves once asserted.
 */
async function expectStamped(result, { repoPath }) {
  const version = await new InstallVersion().resolve(REPO_ROOT);
  const file = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');

  expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
  if (SEMVER.test(version)) {
    expect(JSON.parse(await readFile(file, 'utf8')).version).toEqual(version);
  } else {
    expect(existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).version : undefined).toBeUndefined();
  }
}

// Routing spec for the real init-claude set_ci_ignored_patterns.sh,
// setup_docs_structure.sh and setup_templates.sh engine_dispatch shims
// (issue #745, docker batch 1) and stamp_arcanum_version.sh (issue #746,
// docker batch 2), under engine.mode=shell, native and docker (a
// passthrough fake `docker`). Each shim dispatches with its cwd as the
// repo (`--prepend-repo-path`), so the docker run's argv is
// `<command> <repo> <args...>`.
describe('init-claude setup engine_dispatch routing (via the real shims)', () => {
  // stamp_arcanum_version.sh declares `--needs=global-config`: the docker
  // run always carries `-e CLAUDE_CONFIG_DIR`, plus a `:ro` mount of
  // `$CLAUDE_CONFIG_DIR/arcanum-config.json` only when that file exists.
  itRoutesWithInvocationLog(
    'stamp_arcanum_version.sh with a global arcanum-config.json',
    path.join(SCRIPTS_DIR, 'stamp_arcanum_version.sh'),
    {
      command: 'init-claude-stamp-arcanum-version',
      prepare: async ({ configDir }) => {
        await writeFile(path.join(configDir, 'arcanum-config.json'), '{}');

        return { args: [] };
      },
      check: expectStamped,
      dockerArgs: ({ repoPath }) => [repoPath],
      dockerMounts: ({ configDir }) => {
        const file = path.join(configDir, 'arcanum-config.json');

        return [`${file}:${file}:ro`];
      },
      dockerEnvNames: ['CLAUDE_CONFIG_DIR']
    }
  );

  itRoutesWithInvocationLog(
    'stamp_arcanum_version.sh without a global arcanum-config.json',
    path.join(SCRIPTS_DIR, 'stamp_arcanum_version.sh'),
    {
      command: 'init-claude-stamp-arcanum-version',
      prepare: async () => ({ args: [] }),
      check: expectStamped,
      dockerArgs: ({ repoPath }) => [repoPath],
      dockerEnvNames: ['CLAUDE_CONFIG_DIR']
    }
  );

  itRoutesWithInvocationLog('set_ci_ignored_patterns.sh', path.join(SCRIPTS_DIR, 'set_ci_ignored_patterns.sh'), {
    command: 'init-claude-set-ci-ignored-patterns',
    prepare: async () => ({ args: ['codacy*', 'lint'] }),
    check: async (result, { repoPath }) => {
      const file = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');

      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
        'auto-fix-all': { ignored_check_patterns: ['codacy*', 'lint'] }
      });
    },
    dockerArgs: ({ repoPath }) => [repoPath, 'codacy*', 'lint']
  });

  itRoutesWithInvocationLog('setup_docs_structure.sh', path.join(SCRIPTS_DIR, 'setup_docs_structure.sh'), {
    command: 'init-claude-setup-docs-structure',
    prepare: async ({ repoPath }) => {
      await writeFile(path.join(repoPath, 'AGENTS.md'), '# Agents\n');

      return { args: [] };
    },
    check: async (result, { repoPath }) => {
      expect(result).toEqual({
        stdout: `Created:\n${DOCS_FILES.map((file) => `  ${file}\n`).join('')}AGENTS.md: appended Documentation section\n`,
        stderr: '',
        code: 0
      });
      DOCS_FILES.forEach((file) => expect(existsSync(path.join(repoPath, file))).withContext(file).toBeTrue());
      expect(await readFile(path.join(repoPath, 'AGENTS.md'), 'utf8')).toContain('## Documentation');
    },
    dockerArgs: ({ repoPath }) => [repoPath]
  });

  itRoutesWithInvocationLog('setup_templates.sh', path.join(SCRIPTS_DIR, 'setup_templates.sh'), {
    command: 'init-claude-setup-templates',
    prepare: async () => ({ args: [] }),
    check: (result, { repoPath }) => {
      expect(result).toEqual({ stdout: `Created: ${TEMPLATES.join(' ')}\n`, stderr: '', code: 0 });
      TEMPLATES.forEach((name) => {
        expect(existsSync(path.join(repoPath, '.github', name))).withContext(name).toBeTrue();
      });
    },
    dockerArgs: ({ repoPath }) => [repoPath]
  });
});
