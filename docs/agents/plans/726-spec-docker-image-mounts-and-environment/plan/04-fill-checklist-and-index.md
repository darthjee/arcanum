# Fill the checklist and update the index

Apply the derivation rules from `mounts.md` and `environment.md` to every row of `docs/agents/specs/docker/checklist.md`, then bring `docs/agents/specs/docker.md` up to date.

Checklist:

- For each dispatched or native-only row, read the shell implementation (`<script>`'s `_shell.sh` twin) and its native command under `core/lib/commands/` to confirm:
  - whether it reads or writes under `CLAUDE_CONFIG_DIR` (`ro` vs. `rw`);
  - whether it runs `gh`, and whether it touches a git remote.
- Replace every `?` in `mounts` and fill `env` per the rules in `mounts.md` and `environment.md`.
- Replace the `?` in `credentials` where it can be resolved. `auto-fix-issue-run-checks` stays as "depends on the target project's check script", with a note pointing at #727/#733.
- Leave the "Not routed through dispatch" section alone, because #733 owns it.
- Update the column legend: `?` no longer means "until #726", only "not determinable".

Index (`docker.md`):

- **Status:** image, mounts and environment are written.
- **Open points:** mark Worktrees and path identity, File ownership, Credentials, Platforms, and the environment half of Nested calls as resolved, each linking to the part that resolves it.
- **Sub-issue map:** mark #726 done/merged, mark #725 as done if it still says "In progress", and note the image-publishing follow-up under #728, or as a new sub-issue to be created.

## Files to Change

- `docs/agents/specs/docker/checklist.md` — fill the `mounts`/`env` columns, resolve the `?` credentials, update the legend.
- `docs/agents/specs/docker.md` — Status, Open points, sub-issue map.
