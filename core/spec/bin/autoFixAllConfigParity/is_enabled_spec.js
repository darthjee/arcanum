import { createFixtureRepo, runPair, seedConfig } from '../../support/factories/autoFixAllConfigParitySetup.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-config-is-enabled" migrated
// entrypoint (issue #261) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract". Runs auto-fix-all/scripts/config_is_enabled_shell.sh
// (directly — not through config.sh's engine_dispatch shim, so this
// isn't circular) and `core/bin/arcanum auto-fix-all-config-is-enabled`
// against identically-seeded fixture repos, asserting byte-identical
// stdout and exit code for both. Every fixture directory is `git
// init`'d, since `repo_path_enter` (shell) requires `repo_path` to be an
// actual git repository.
describe('auto-fix-all-config-* parity (shell vs. native) — is-enabled', () => {
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

  it('matches shell output (exit 0, empty stdout) when the resolved value is "true"', async () => {
    const seeded = { 'auto-fix-all': { auto_merge: true } };

    await seedConfig(shellRepo, { newConfig: seeded });
    await seedConfig(nativeRepo, { newConfig: seeded });

    const { shell, native } = await runPair('is-enabled', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('');
  });

  it('matches shell output (exit 1, empty stdout) when the resolved value is "false"/absent', async () => {
    const { shell, native } = await runPair('is-enabled', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(1);
    expect(shell.stdout).toEqual('');
  });
});
