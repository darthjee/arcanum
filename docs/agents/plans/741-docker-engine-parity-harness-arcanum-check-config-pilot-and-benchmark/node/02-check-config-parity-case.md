# arcanum-check-config parity case

Add `core/spec/docker/arcanumCheckConfig_spec.js`. Use the setup from `core/spec/bin/arcanumCheckConfig_spec.js`: a temp repo, a temp `HOME`, and a temp `CLAUDE_CONFIG_DIR` holding `arcanum-config.json`. Through the parity helper, run the real shim's dispatch call (`arcanum-check-config "" --native-only --needs=global-config HOME CLAUDE_CONFIG_DIR -- <repo> <key>`) natively and in the container, and assert:

- stdout is byte-identical and the exit code is the same for:
  - a global-only key (`git.authors`);
  - a key set in the local tier;
  - a key set in the repo tier;
  - an unset key;
- the malformed-key case (`git`) gives the same exit code 1 and the same `arcanum:` error on stderr;
- no files in the repo or the config dir are created or changed (the command is read-only);
- the same results from a git worktree of the fixture repo (path identity, git common dir mount).

The temp dirs must be under a Docker Desktop shared path on macOS. `tempDir.js`'s default (`os.tmpdir()`, under `/var/folders`) is shared by default; note it in a comment.

## Files to Change

- `core/spec/docker/arcanumCheckConfig_spec.js` (new): the pilot's parity case.
