import { createFixtureRepo, runPair, seedConfig } from '../../support/factories/autoFixAllConfigParitySetup.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-config-get" migrated entrypoint
// (issue #261) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// auto-fix-all/scripts/config_get_shell.sh (directly — not through
// config.sh's engine_dispatch shim, so this isn't circular) and
// `core/bin/arcanum auto-fix-all-config-get` against identically-seeded
// fixture repos, asserting byte-identical stdout and exit code for both.
// Every fixture directory is `git init`'d, since `repo_path_enter`
// (shell) requires `repo_path` to be an actual git repository.
describe('auto-fix-all-config-* parity (shell vs. native) — get', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createFixtureRepo('arcanum-core-afac-parity-shell-');
    nativeRepo = await createFixtureRepo('arcanum-core-afac-parity-native-');
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  it('matches shell output for a key present in the new file', async () => {
    const seeded = { 'auto-fix-all': { auto_merge: true } };

    await seedConfig(shellRepo, { newConfig: seeded });
    await seedConfig(nativeRepo, { newConfig: seeded });

    const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('true\n');
  });

  it('matches shell output for a key present only in the legacy file', async () => {
    const seeded = { auto_merge: false };

    await seedConfig(shellRepo, { legacyConfig: seeded });
    await seedConfig(nativeRepo, { legacyConfig: seeded });

    const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('false\n');
  });

  it('matches shell output (default "false") for a key absent everywhere', async () => {
    const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('false\n');
  });

  it('matches shell output for a clear_context-style key, ignoring the legacy file', async () => {
    const seeded = { clear_context: true };

    await seedConfig(shellRepo, { legacyConfig: seeded });
    await seedConfig(nativeRepo, { legacyConfig: seeded });

    const { shell, native } = await runPair('get', shellRepo, nativeRepo, ['clear_context']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('false\n');
  });
});
