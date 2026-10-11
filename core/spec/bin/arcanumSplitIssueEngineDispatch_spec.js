import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'create_sub_issue_file.sh');
const COMMAND = 'arcanum-split-issue-create-sub-issue-file';
const TITLE = 'Hello, World! Foo-Bar';
const FILE = 'docs/agents/issues/999_01_hello_world_foo_bar.md';

/**
 * @param {object} result - the shim's result.
 * @param {{repoPath: string}} ctx - the case context.
 * @returns {Promise<void>} resolves once asserted.
 */
async function expectSubIssueFile(result, { repoPath }) {
  expect(result).toEqual({ stdout: `FILE=${FILE}\n`, stderr: '', code: 0 });
  expect(await readFile(path.join(repoPath, FILE), 'utf8')).toEqual(`# ${TITLE}\n\nbody content\n`);
}

// Routing spec for the real arcanum-split-issue create_sub_issue_file.sh
// engine_dispatch shim (issue #746, docker batch 2), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The shim declares `--path-arg=4:ro`: a <body_file> outside the repo is
// mounted read-only on its own; one inside the repo needs no mount.
describe('arcanum-split-issue-create-sub-issue-file engine_dispatch routing (via the real shim)', () => {
  itRoutesWithInvocationLog('create_sub_issue_file.sh with a body file inside the repo', SHIM_SCRIPT, {
    command: COMMAND,
    prepare: async ({ repoPath }) => {
      await writeFile(path.join(repoPath, 'body.md'), 'body content\n');

      return { args: [repoPath, '999', TITLE, path.join(repoPath, 'body.md')] };
    },
    check: expectSubIssueFile,
    dockerArgs: ({ repoPath }) => [repoPath, '999', TITLE, path.join(repoPath, 'body.md')]
  });

  let bodyFile;

  itRoutesWithInvocationLog('create_sub_issue_file.sh with a body file outside the repo', SHIM_SCRIPT, {
    command: COMMAND,
    prepare: async ({ repoPath }) => {
      const bodyDir = await realpath(await createTempDir('arcanum-core-split-issue-body-'));

      bodyFile = path.join(bodyDir, 'body.md');
      await writeFile(bodyFile, 'body content\n');

      return { args: [repoPath, '999', TITLE, bodyFile], cleanup: () => removeTempDir(bodyDir) };
    },
    check: expectSubIssueFile,
    dockerArgs: ({ repoPath }) => [repoPath, '999', TITLE, bodyFile],
    dockerMounts: () => [`${bodyFile}:${bodyFile}:ro`]
  });
});
