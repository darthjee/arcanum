import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  commitThenPushAssertions, itRoutesRemoteEngineDispatch
} from '../support/sharedExamples/remoteEngineDispatchRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-new-issue', 'scripts', 'commit_issue.sh');
const ISSUE_FILE = 'docs/agents/issues/7-add-change.md';

// Routing spec for the real auto-new-issue/scripts/commit_issue.sh
// engine_dispatch shim (docker batch 4, issue #748), under
// engine.mode=shell, native and docker (a passthrough fake `docker`).
// The shim declares `--needs=global-config,gitconfig,remote` and no
// `--path-arg` (<file_path> is inside the repo): every mode commits the
// issue file and fails the push offline.
describe('auto-new-issue commit_issue.sh engine_dispatch routing (via the real shim)', () => {
  itRoutesRemoteEngineDispatch('commit_issue.sh', SHIM_SCRIPT, {
    command: 'auto-new-issue-commit-issue',
    needs: ['global-config', 'gitconfig', 'remote'],
    reachesRemote: true,
    prepare: async ({ repoPath }) => {
      await mkdir(path.dirname(path.join(repoPath, ISSUE_FILE)), { recursive: true });
      await writeFile(path.join(repoPath, ISSUE_FILE), '# Issue 7: Add change\n');

      return { args: [repoPath, ISSUE_FILE, '7', 'Spec Model', 'model@example.com'] };
    },
    ...commitThenPushAssertions('docs(issue): add issue file (issue #7)')
  });
});
