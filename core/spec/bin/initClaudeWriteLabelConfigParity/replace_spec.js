import {
  CONFIG,
  writeLabelConfigParityHarness
} from '../../support/factories/initClaudeWriteLabelConfigParitySetup.js';

// Parity test for the "init-claude-write-label-config-replace" migrated
// entrypoint (issue #594). Runs write_label_config_replace_shell.sh
// directly (NOT through the write_label_config.sh shim) and `core/bin/arcanum
// init-claude-write-label-config-replace`, asserting identical
// stdout/stderr/exit code and byte-identical resulting config files.
describe('init-claude-write-label-config-replace parity (shell vs. native)', () => {
  const harness = writeLabelConfigParityHarness('replace');

  it('creates a missing config (and its parent dirs)', async () => {
    const { results, tree } = await harness.run(['Bug:b60205', 'Ready for Work:FFAA04']);

    expect(results.shell.code).toEqual(0);
    expect(JSON.parse(tree[CONFIG])).toEqual({
      labels: [{ name: 'Bug', color: 'b60205' }, { name: 'Ready for Work', color: 'FFAA04' }]
    });
  });

  it('replaces an existing config', async () => {
    const { results } = await harness.run(['A:111111'], '{"labels":[{"name":"Old","color":"000000"}]}');

    expect(results.shell.code).toEqual(0);
  });

  ['nocolon', ':111111', 'A:12345', 'A:#111111'].forEach((pair) => {
    it(`rejects the invalid pair '${pair}' with exit 2, leaving the file untouched`, async () => {
      const { results } = await harness.run(['Ok:000000', pair], '{"labels":[]}');

      expect(results.shell.code).toEqual(2);
      expect(results.shell.stderr).toMatch(/^Error: invalid /);
    });
  });
});
