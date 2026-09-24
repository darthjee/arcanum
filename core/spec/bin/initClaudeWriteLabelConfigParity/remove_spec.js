import {
  CONFIG,
  writeLabelConfigParityHarness
} from '../../support/factories/initClaudeWriteLabelConfigParitySetup.js';

// Parity test for the "init-claude-write-label-config-remove" migrated
// entrypoint (issue #594). Runs write_label_config_remove_shell.sh
// directly (NOT through the write_label_config.sh shim) and `core/bin/arcanum
// init-claude-write-label-config-remove`, asserting identical
// stdout/stderr/exit code and byte-identical resulting config files.
describe('init-claude-write-label-config-remove parity (shell vs. native)', () => {
  const harness = writeLabelConfigParityHarness('remove');
  const SEED = '{"labels":[{"name":"A","color":"111111"},{"name":"B","color":"222222"},{"name":"a","color":"333333"}]}';

  it('removes exact-name matches, ignoring unknown names', async () => {
    const { results, tree } = await harness.run(['A', 'Nope'], SEED);

    expect(results.shell.code).toEqual(0);
    expect(JSON.parse(tree[CONFIG]).labels.map(({ name }) => name)).toEqual(['B', 'a']);
  });

  it('writes an empty array when everything is removed', async () => {
    const { tree } = await harness.run(['A', 'B', 'a'], SEED);

    expect(tree[CONFIG]).toEqual('{\n  "labels": []\n}\n');
  });

  it('writes an empty array for a missing config', async () => {
    const { results, tree } = await harness.run(['A']);

    expect(results.shell.code).toEqual(0);
    expect(tree[CONFIG]).toEqual('{\n  "labels": []\n}\n');
  });

  it('treats malformed JSON as an empty config', async () => {
    await harness.run(['A'], 'not json');
  });

  it('rejects a name:color argument with exit 2, leaving the file untouched', async () => {
    const { results } = await harness.run(['A', 'B:222222'], SEED);

    expect(results.shell.code).toEqual(2);
    expect(results.shell.stderr).toContain('remove takes bare names');
  });
});
