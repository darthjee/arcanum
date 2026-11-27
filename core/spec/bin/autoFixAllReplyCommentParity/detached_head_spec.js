import { access } from 'node:fs/promises';
import path from 'node:path';
import { runReplyCommentParityCase } from '../../support/factories/autoFixAllReplyCommentParitySetup.js';
import { detachHead, expectDetachedHeadRefusal, snapshotRepoState } from '../../support/utils/detachedHead.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

// Full context (network isolation, fake gh/fetch, fixture-repo seeding)
// lives in
// core/spec/support/factories/autoFixAllReplyCommentParitySetup.js.

/**
 * @param {string} file - the path to check.
 * @returns {Promise<boolean>} whether `file` exists.
 */
async function exists(file) {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

describe('auto-fix-all-reply-comment parity (shell vs. native) — detached HEAD (issue #947)', () => {
  let captureDir;

  beforeEach(async () => {
    captureDir = await createTempDir('arcanum-core-afarc-detached-');
  });

  afterEach(async () => {
    await removeTempDir(captureDir);
  });

  it('refuses identically on both sides before posting any comment, leaving the repo and the remote untouched', async () => {
    const shellCapture = path.join(captureDir, 'shell-body.md');
    const nativeCapture = path.join(captureDir, 'native-body.md');
    const before = new Map();

    await runReplyCommentParityCase({
      extraEnv: {
        FAKE_GH_PR_NUMBER: '42',
        ARCANUM_TEST_FAKE_FETCH: 'success',
        FAKE_GH_COMMENT_CAPTURE_FILE: shellCapture,
        FAKE_FETCH_COMMENT_CAPTURE_FILE: nativeCapture
      },
      useFakeFetchPreload: true,
      prepareRepo: async (repo) => {
        await detachHead(repo.repoPath);
        before.set(repo.repoPath, await snapshotRepoState(repo));
      },
      assert: async ({ shell, native, shellRepo, nativeRepo }) => {
        expectDetachedHeadRefusal({ shell, native });
        expect(await snapshotRepoState(shellRepo)).toEqual(before.get(shellRepo.repoPath));
        expect(await snapshotRepoState(nativeRepo)).toEqual(before.get(nativeRepo.repoPath));
      }
    });

    expect(await exists(shellCapture)).toBeFalse();
    expect(await exists(nativeCapture)).toBeFalse();
  });
});
