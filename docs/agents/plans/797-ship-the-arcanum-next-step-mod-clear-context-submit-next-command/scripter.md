# Scripter Plan: Ship the arcanum-next-step mod (clear context + submit next command)

Main plan: [plan.md](plan.md)

## Shared contracts

Produces `scripts/build_release_zip.sh --list` exactly as in
[plan.md](plan.md#shared-contracts): the would-be `MANIFEST` on stdout, one path per
line, nothing else; exit 0; no zip, no output dir, no `MANIFEST` file. Without
`--list`, byte-identical to today.

## Implementation Steps

### Step 1 — Add `--list` to `build_release_zip.sh`

Parse `--list` as the first argument (before the optional `output_dir`). Factor the
file selection (`git ls-files` filtered by `is_excluded`) so both paths share it;
with `--list`, print the `FILES` array and exit before `mkdir`/`zip`. Update the
header comment's usage line.

## Files to Change

- `scripts/build_release_zip.sh` — `--list` mode.

## Notes

- `node`'s spec runs this from `core/spec` inside the test container (repo root
  mounted at `/home/node/app`), so it must not need `zip`.
