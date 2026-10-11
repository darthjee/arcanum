import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'render_issue.sh');
const COMMAND = 'discuss-issue-render-issue';
const SECTIONS = ['Something broke', '## Description\nDesc text'];
const RENDERED = '# Issue: Something broke\n\n## Description\nDesc text\n';

// Routing spec for the real discuss-issue render_issue.sh engine_dispatch
// shim (issue #746, docker batch 2), under engine.mode=shell, native and
// docker (a passthrough fake `docker`). The shim dispatches with
// `--prepend-repo-path --path-arg=1:rw`: an <output_file> outside the
// repo gets its directory mounted read-write; one inside needs no mount
// (and, from the repo itself as cwd, no argv rewrite either).
describe('discuss-issue-render-issue engine_dispatch routing (via the real render_issue.sh shim)', () => {
  itRoutesWithInvocationLog('render_issue.sh with a relative output file inside the repo', SHIM_SCRIPT, {
    command: COMMAND,
    prepare: async () => ({ args: ['issue.md', ...SECTIONS] }),
    check: async (result, { repoPath }) => {
      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(await readFile(path.join(repoPath, 'issue.md'), 'utf8')).toEqual(RENDERED);
    },
    dockerArgs: ({ repoPath }) => [repoPath, 'issue.md', ...SECTIONS]
  });

  let outDir;

  itRoutesWithInvocationLog('render_issue.sh with an output file outside the repo', SHIM_SCRIPT, {
    command: COMMAND,
    prepare: async () => {
      outDir = await realpath(await createTempDir('arcanum-core-render-issue-out-'));

      return { args: [path.join(outDir, 'issue.md'), ...SECTIONS], cleanup: () => removeTempDir(outDir) };
    },
    check: async (result) => {
      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });
      expect(await readFile(path.join(outDir, 'issue.md'), 'utf8')).toEqual(RENDERED);
    },
    dockerArgs: ({ repoPath }) => [repoPath, path.join(outDir, 'issue.md'), ...SECTIONS],
    dockerMounts: () => [`${outDir}:${outDir}`]
  });
});
