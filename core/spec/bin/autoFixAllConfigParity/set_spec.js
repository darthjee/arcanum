import { createFixtureRepo, runPair } from '../../support/factories/autoFixAllConfigParitySetup.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-config-set" migrated entrypoint
// (issue #261) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs
// auto-fix-all/scripts/config_set_shell.sh (directly — not through
// config.sh's engine_dispatch shim, so this isn't circular) and
// `core/bin/arcanum auto-fix-all-config-set` against identically-seeded
// fixture repos, asserting byte-identical stdout and exit code for both.
// The "valid write" case round-trips through `get` to confirm the
// persisted value matches on both sides. Every fixture directory is `git
// init`'d, since `repo_path_enter` (shell) requires `repo_path` to be an
// actual git repository.
describe('auto-fix-all-config-* parity (shell vs. native) — set', () => {
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

  it('matches shell output (exit 0, empty stdout) for a valid write, and the persisted value matches on both sides', async () => {
    const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge', 'true']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('');

    const getResult = await runPair('get', shellRepo, nativeRepo, ['auto_merge']);

    expect(getResult.shell.stdout).toEqual('true\n');
    expect(getResult.native.stdout).toEqual(getResult.shell.stdout);
  });

  it('matches shell exit code (1) and empty stdout for missing args', async () => {
    const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(1);
    expect(shell.stdout).toEqual('');
  });

  it('matches shell exit code (1) and empty stdout for an invalid value', async () => {
    const { shell, native } = await runPair('set', shellRepo, nativeRepo, ['auto_merge', 'yes']);

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(1);
    expect(shell.stdout).toEqual('');
  });
});
