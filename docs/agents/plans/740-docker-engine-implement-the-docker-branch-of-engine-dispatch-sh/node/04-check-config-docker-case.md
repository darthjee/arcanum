# arcanum-check-config docker case

In `core/spec/bin/arcanumCheckConfig_spec.js`, replace "fails without a fallback when engine.mode is docker" with the native-only rule. With `engine.mode=docker`, the real map's current `arcanum-check-config` status (`native`) runs native on the host, prints the row-3 warning on stderr, and produces the same stdout and exit code as the native run. Make sure no real `docker` is reached: put a scripted fake `docker` first on `PATH` and assert its call log is empty. Update the spec's header comment.

## Files to Change

- `core/spec/bin/arcanumCheckConfig_spec.js` — docker case and header comment.
