# Update commands_spec.js

`core/spec/lib/core/commands_spec.js` has a `'keeps log: false on dispatch-fixture'` assertion (`expect(COMMANDS['dispatch-fixture'].log).toBe(false)`) whose subject no longer exists once `dispatch-fixture` is removed. Remove this test. Do not add a replacement — `log: false`'s own future (keep as an unused option, drop it, or re-anchor it elsewhere) is tracked separately in #343, out of scope here.

## Files to Change

- `core/spec/lib/core/commands_spec.js` — remove the `'keeps log: false on dispatch-fixture'` test.
