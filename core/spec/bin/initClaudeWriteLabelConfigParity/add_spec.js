import {
  CONFIG,
  writeLabelConfigParityHarness
} from '../../support/factories/initClaudeWriteLabelConfigParitySetup.js';

// Parity test for the "init-claude-write-label-config-add" migrated
// entrypoint (issue #594). Runs write_label_config_add_shell.sh directly
// (NOT through the write_label_config.sh shim) and `core/bin/arcanum
// init-claude-write-label-config-add`, asserting identical
// stdout/stderr/exit code and byte-identical resulting config files.
describe('init-claude-write-label-config-add parity (shell vs. native)', () => {
  const harness = writeLabelConfigParityHarness('add');

  it('upserts in place and appends new names', async () => {
    const { results, tree } = await harness.run(
      ['C:333333', 'A:aaaaaa'],
      '{"labels":[{"name":"A","color":"111111"},{"name":"B","color":"222222"}]}'
    );

    expect(results.shell.code).toEqual(0);
    expect(JSON.parse(tree[CONFIG]).labels).toEqual([
      { name: 'A', color: 'aaaaaa' },
      { name: 'B', color: '222222' },
      { name: 'C', color: '333333' }
    ]);
  });

  it('starts from an empty list for a missing config', async () => {
    const { results } = await harness.run(['Ready for Work:ffaa04']);

    expect(results.shell.code).toEqual(0);
  });

  it('starts from an empty list for an empty file', async () => {
    await harness.run(['A:000000'], '');
  });

  it('rejects an invalid pair with exit 2, leaving the file untouched', async () => {
    const { results } = await harness.run(['A:000000', 'bad'], '{"labels":[{"name":"X","color":"000000"}]}');

    expect(results.shell.code).toEqual(2);
    expect(results.shell.stderr).toEqual('Error: invalid pair \'bad\' — expected <label name>:<hex color>\n');
  });
});
