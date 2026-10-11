# Tick the checklist rows and update the docker spec status

Tick the 10 batch-4 rows in `docs/agents/specs/docker/checklist.md` with `#748`. For any command without a parity case, add a `notes` entry saying why (e.g. covered only by the opt-in ssh case, or irreversible remote side effects). Update the status line in `docs/agents/specs/docker.md` to mention batch 4, the first batch that forwards git remote credentials across a whole credential class.

## Files to Change

- `docs/agents/specs/docker/checklist.md`
- `docs/agents/specs/docker.md`
