import {
  buildRepoPair,
  runPair,
  seedExistingLocalBranch,
  seedRemoteOnlyBranch
} from '../../support/factories/autoFixAllCheckoutFromMainParitySetup.js';

// Parity test for the "auto-fix-all-checkout-from-main" migrated
// entrypoint (issue #258) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/checkout_from_main.sh
// (directly — the scripter half of this plan, which renames this file to
// checkout_from_main_shell.sh and replaces it with a thin engine_dispatch
// shim, hasn't landed on this branch yet; today's checkout_from_main.sh
// content IS the "straight rename, no behavior change" shell fallback
// plan.md describes, so it's the correct comparison target either way)
// and `core/bin/arcanum auto-fix-all-checkout-from-main` against
// identically-seeded fixture repos, asserting byte-identical stdout and
// exit code for both. This is what proves node/01's `DispatchFailure`
// exit-code generalization actually reaches the real process exit code
// (exit 2 on a merge conflict), not just the thrown object in isolation.
//
// Note: neither the shell script nor the native module redirects/quiets
// `git checkout`/`git merge`'s own porcelain output — e.g. `git checkout
// -b <branch> <remote-ref>` prints a "branch '<branch>' set up to track
// '<remote-ref>'." line to stdout (not stderr), and a failed `git merge
// --no-edit origin/main` prints its own "Auto-merging .../CONFLICT
// .../Automatic merge failed..." lines to stdout too, ahead of the
// conflicted-path list. Both sides forward this porcelain text
// verbatim, so `native.stdout === shell.stdout` below is the real
// parity assertion; the additional `shell.stdout` checks only assert on
// the substantive `BRANCH=`/`STATUS=` contract, not git's exact
// (version-dependent) wording.
describe('auto-fix-all-checkout-from-main parity (shell vs. native) — happy path', () => {
  describe('a fresh branch, with origin/main present (default fixture shape)', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair();

      try {
        const { shell, native } = await runPair('42', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain('BRANCH=issue-42\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('an existing local branch, merged cleanly with origin/main', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedExistingLocalBranch, '42');

      try {
        const { shell, native } = await runPair('42', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('BRANCH=issue-42\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('a remote-only branch (no local ref)', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedRemoteOnlyBranch, '77');

      try {
        const { shell, native } = await runPair('77', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain('BRANCH=issue-77\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });
});
