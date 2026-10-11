import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts');
const SHIM_SCRIPT = path.join(SCRIPTS_DIR, 'create_sub_issue_file.sh');
const SUB_ISSUE_FILE = 'docs/agents/issues/7_01_x.md';
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
/**
 * Removes the fixture repo's `origin` and seeds `engine.mode` plus one
 * sub-issue file (`7_01_x.md`) for issue #7.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - the engine mode.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedSubIssueWithoutOrigin(repo, mode) {
  const file = path.join(repo.repoPath, SUB_ISSUE_FILE);

  await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);
  await seedEngineMode(repo, mode);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, '# X\n\nbody\n');
}

describe('arcanum-split-issue engine_dispatch routing (via the real shims)', () => {
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

  // Docker batch 3 (issue #747): create_sub_issue.sh and
  // push_sub_issues.sh create GitHub issues, so their cases run in a repo
  // with no `origin` and fail before any GitHub call. Only the shell
  // side reports the missing origin on stderr (native and the
  // passthrough fake `docker` print core/bin/arcanum's own outcome). The
  // docker run carries the `--needs=global-config,gitconfig,gh` mounts
  // and env. create_sub_issue.sh's <sub_issue_file> has no `--path-arg`:
  // it is read relative to the repo (the container's working directory).
  describe('gh commands (no origin)', () => {
    let repoPath;
    const noOrigin = () => `Error: '${repoPath}' is not a git repository or has no 'origin' remote\n`;

    itRoutesGhEngineDispatch(
      'create_sub_issue.sh',
      path.join(SCRIPTS_DIR, 'create_sub_issue.sh'),
      async (repo, mode) => {
        repoPath = repo.repoPath;
        await seedSubIssueWithoutOrigin(repo, mode);

        return { args: [repo.repoPath, '7', SUB_ISSUE_FILE] };
      },
      {
        shell: (result) => {
          expect(result).toEqual({
            stdout: 'Creating sub-issue 01 for issue #7: X\n\nSTATUS=failed\n',
            stderr: noOrigin(),
            code: 1
          });
        },
        native: (result) => {
          expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOrigin()}`, code: 1 });
        },
        docker: (result, calls, world) => {
          expect(result).toEqual({ stdout: '', stderr: `arcanum: ${noOrigin()}`, code: 1 });
          expectGhNeedsRun(
            calls, repoPath, ['arcanum-split-issue-create-sub-issue', repoPath, '7', SUB_ISSUE_FILE], world
          );
        }
      }
    );

    const PUSH_STDOUT = `STATUS=failed\nCREATED=\nFAILED=${SUB_ISSUE_FILE}\n`;

    itRoutesGhEngineDispatch(
      'push_sub_issues.sh',
      path.join(SCRIPTS_DIR, 'push_sub_issues.sh'),
      async (repo, mode) => {
        repoPath = repo.repoPath;
        await seedSubIssueWithoutOrigin(repo, mode);

        return { args: [repo.repoPath, '7'] };
      },
      {
        shell: (result) => {
          expect(result).toEqual({ stdout: PUSH_STDOUT, stderr: noOrigin(), code: 1 });
        },
        native: (result) => {
          expect(result).toEqual({ stdout: PUSH_STDOUT, stderr: '', code: 1 });
        },
        docker: (result, calls, world) => {
          expect(result).toEqual({ stdout: PUSH_STDOUT, stderr: '', code: 1 });
          expectGhNeedsRun(calls, repoPath, ['arcanum-split-issue-push-sub-issues', repoPath, '7'], world);
        }
      }
    );
  });
});
