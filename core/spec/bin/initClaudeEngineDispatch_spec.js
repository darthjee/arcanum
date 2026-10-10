import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

// Routing spec for the real init-claude set_ci_ignored_patterns.sh,
// setup_docs_structure.sh and setup_templates.sh engine_dispatch shims
// (issue #745, docker batch 1), under engine.mode=shell, native and
// docker (a passthrough fake `docker`). Each shim dispatches with its
// cwd as the repo (`--prepend-repo-path`), so the docker run's argv is
// `<command> <repo> <args...>`.
describe('init-claude setup engine_dispatch routing (via the real shims)', () => {
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
