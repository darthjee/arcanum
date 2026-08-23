# has-shipit-label, add-tag, remove-tag

Read `auto-fix-all/scripts/github.sh`'s `cmd_has_shipit_label`, `cmd_add_tag`, `cmd_remove_tag`, and `arcanum/_lib/tag_mutate.sh` for the exact contract. Reuse the existing native precedent directly rather than re-deriving from scratch: `AutoFixAllQueue.js` already implements this exact shape (`_mutateTag`/`_fetchLabels`/`_addLabel`/`_removeLabel`, built on `Tags.js`'s exported `LABEL_TO_TAG` table inverted to a `TAG_TO_LABEL` map) for its own best-effort mutation of `enqueued`/`ready_for_work`/`created`.

- **`hasShipitLabel(repoPath, id)`**: fetch the issue's labels via REST (`GET /repos/{repo}/issues/{id}` or the labels sub-resource), case-insensitive exact match against `shipit`. Exit 0 if found, exit 1 if not (no stdout either way, matching the shell's `grep -qiE` contract). Fetch failure → exit 1 (matches `|| exit 1`).
- **`addTag(repoPath, id, tag)` / `removeTag(repoPath, id, tag)`**: resolve `tag` to its GitHub label name via `Tags.js`'s `LABEL_TO_TAG` inverted (same `TAG_TO_LABEL` construction as `AutoFixAllQueue.js`, or import a shared inversion if convenient — do not hardcode a second copy of the table).
  - **shipit guard** (behavioral gap vs. `AutoFixAllQueue.js`'s version, which never touches `shipit` so never needed this): before doing anything else, if `tag === 'shipit'`, print `Error: shipit is human-only; scripts must not add or remove it` to stderr and exit 1 — `add-tag`/`remove-tag` are exposed directly with an arbitrary `<tag>` argument, unlike `AutoFixAllQueue.js`'s fixed 3-tag internal usage.
  - Fetch current labels via REST; fetch failure → `Error: could not fetch issue #<id> from <repo_ref>` to stderr, exit 1.
  - Already in the desired state (label present for `add`, absent for `remove`) → print `Tag '<tag>' already present on issue #<id> — nothing to do.` (or the `remove` equivalent: `Tag '<tag>' not present on issue #<id> — nothing to do.`), exit 0, no API mutation call.
  - Otherwise call the REST add/remove-label endpoint; failure → `Error: could not update issue #<id> on <repo_ref>` to stderr, exit 1; success → `Added tag '<tag>' to issue #<id> on <repo_ref>` (or `Removed tag '<tag>' from issue #<id> on <repo_ref>`), exit 0.

## Files to Change

- `core/lib/AutoFixAllGithub.js` — add `hasShipitLabel`, `addTag`, `removeTag`, built on `Tags.js`'s `LABEL_TO_TAG`.
