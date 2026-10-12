# Docker parity cases

Add `core/spec/docker/arcanumCreateIssue_spec.js` (pattern: `core/spec/docker/discussIssue_spec.js` and `gitRemote_spec.js`), with the real shims' `engine_dispatch` calls:

- **start:**
  - invalid input (exit 2);
  - `--resume` of an unknown draft;
  - `--new`, which creates a draft (mask its timestamped name and compare the files written under `.claude/state/create-issue/`);
  - `--resume <existing draft>`;
  - drafts present with no flag, which takes exit 4 with `FALLBACK=chat` and `DRAFT=` lines.
- **publish:**
  - missing title/draft (exit 2);
  - an unknown draft;
  - a valid draft without `--confirmed`, which takes exit 4 with `FALLBACK=chat` and creates nothing on GitHub.
- No case for `publish`'s success path. It would create a real GitHub issue; the scripter records this in the checklist `notes`.

For the exit-4 cases, the native side must not be able to open `/dev/tty`. Add an option to `runDockerParity` / `itMatchesNativeInDocker` (e.g. `detachNative: true`) that spawns the native run in a new session with no controlling terminal (`detached: true`, stdin from `/dev/null`). The docker side needs nothing: dispatch never passes `-t`.

Use a fixture origin with a `github.com` URL and a fake `GH_TOKEN`, so `GithubPreflight` passes without network (see the Notes in [node.md](../node.md)). Document the new option in `docs/agents/specs/docker/testing.md`.

## Files to Change

- `core/spec/docker/arcanumCreateIssue_spec.js` — new parity spec.
- `core/spec/support/utils/dockerParity.js` — native detach option.
- `core/spec/support/factories/dockerParitySetup.js` — pass the option through, if needed.
- `docs/agents/specs/docker/testing.md` — document the detach option.
