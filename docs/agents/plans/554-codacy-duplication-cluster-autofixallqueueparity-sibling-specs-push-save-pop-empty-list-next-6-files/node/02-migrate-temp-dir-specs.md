# Migrate the temp-dir specs (pop/empty/list/next/wait-next)
Rewrite each spec's `describe` body as `itMatchesShellForQueueOp(...)` calls. Keep the `describe` labels, `it` descriptions and header comments unchanged. Drop the now-unused imports (`runPair`, `seedQueue`, `expectParity`, `createTempDir`, `removeTempDir`).

Case mapping (all use `github: false`, `args: []`):
- `pop`: seed `['a','b']`, code 0, stdout `''`, followUp `{ op: 'next', expectedStdout: 'b\n' }`.
- `empty`: seed `[]` → code 0, stdout `''`. Seed `['x']` → code 1, stdout `''`.
- `list`: seed `['a','b','c']` → code 0, `'a\nb\nc\n'`. Seed `[]` → code 0, `'(empty)\n'`.
- `next`: seed `['1','2']` → code 0, `'1\n'`. No seed (absent file) → code 0, `'\n'`.
- `wait-next`: seed `['7']` → code 0, `'7\n'`.

## Files to Change
- `core/spec/bin/autoFixAllQueueParity/pop_spec.js`
- `core/spec/bin/autoFixAllQueueParity/empty_spec.js`
- `core/spec/bin/autoFixAllQueueParity/list_spec.js`
- `core/spec/bin/autoFixAllQueueParity/next_spec.js`
- `core/spec/bin/autoFixAllQueueParity/wait_next_spec.js`
