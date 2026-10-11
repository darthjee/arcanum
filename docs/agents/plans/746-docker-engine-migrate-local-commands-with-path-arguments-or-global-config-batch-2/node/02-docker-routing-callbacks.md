# Docker routing callbacks for the batch-2 shims

Give each batch-2 shim a shell/native/docker routing spec through the real shim, using the step-01 helpers. For each path-arg command, cover an in-repo path (repo mount only) and an out-of-repo path (file `:ro` or parent dir `rw`). For stamp, cover a seeded global `arcanum-config.json` (`:ro` mount + `CLAUDE_CONFIG_DIR` env). `write_label_config.sh` already has shell/native routing in `initClaudeLabelsEngineDispatch_spec.js`: add docker there, or move it onto `itRoutesWithInvocationLog`. The others only have shell-vs-native parity specs today, so add their routing specs next to batch 1's (`initClaudeEngineDispatch_spec.js`, `discussIssueConfirmEngineDispatch_spec.js`, plus a new arcanum-split-issue one).

## Files to Change

- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js`: docker callbacks for write_label_config add/remove/replace.
- `core/spec/bin/initClaudeEngineDispatch_spec.js`: stamp_arcanum_version routing (shell/native/docker).
- `core/spec/bin/discussIssueRenderIssueEngineDispatch_spec.js` (new, or folded into the discuss-issue routing spec): render_issue routing.
- `core/spec/bin/arcanumSplitIssueEngineDispatch_spec.js` (new): create_sub_issue_file routing.
