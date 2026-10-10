# Native-only spec for init-claude-set-next-step-auto

`core/spec/bin/initClaudeSetNextStepAuto_spec.js` currently expects the "not-docker-ready yet" fallback warning under `engine.mode=docker`. Change it the same way the pilot changed `arcanumCheckConfig_spec.js`:

- the command reaches `docker run` (passthrough fake) with only the repo mount, and its result matches native with empty stderr;
- with `DOCKER_PRESETS.daemonDown`, it falls back to native on the host with `dockerUnavailableWarning(...)` and makes no `run` call.

## Files to Change

- `core/spec/bin/initClaudeSetNextStepAuto_spec.js`
