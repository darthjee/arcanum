# Infra Plan: Fix SC2016 cluster: verify single-quoted expressions across 6 findings in 5 scripts

Main plan: [plan.md](plan.md)

## Shared contracts

None — this agent's work is fully independent of `scripter`'s.

## Implementation Steps

### Step 1 — Verify and annotate the docker-entrypoint.sh finding
Confirm that `$0`/`$@` in `exec su node -s /bin/sh -c 'exec "$0" "$@"' -- "$@"` are meant to expand inside the `su`'d subshell (not the outer `docker-entrypoint.sh` process) — the single quotes deliberately delay expansion until `su`'s `-c` argument is evaluated by the inner `/bin/sh`, with `"$0" "$@"` in the outer script supplying the positional values via `su ... -- "$@"`. This is expected to confirm as intentional based on the issue's analysis, but verify individually rather than assuming — e.g. by tracing how `docker-entrypoint.sh` is invoked from `core/Dockerfile`/`core/docker-compose.yml` and confirming a container start still runs the intended `CMD`/override command as `node` after this change.

- If confirmed intentional, add a `# shellcheck disable=SC2016` comment on the line above line 32, naming why (e.g. `# $0/$@ meant to expand inside the su'd subshell, not here`).
- If it turns out to be a genuine bug, fix the quoting instead and verify a container still starts and runs its command correctly as the `node` user.

## Files to Change
- `core/docker-entrypoint.sh:32` — `exec su node -s /bin/sh -c 'exec "$0" "$@"' -- "$@"`; add disable comment (subshell expansion).

## Notes
- No script's actual behavior should change as a result of this work, unless verification finds a genuine bug.
