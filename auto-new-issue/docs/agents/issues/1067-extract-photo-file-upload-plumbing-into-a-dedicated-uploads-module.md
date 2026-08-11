# Extract photo/file upload plumbing into a dedicated uploads module

## Context

This is a follow-up to issue #1066 (the `SourcePhoto` 500 bug), which has already been fixed
separately. That issue's original "Solution" section proposed two things: (a) extracting photo
upload machinery out of the `games` app, and (b) inventing a new YAML-based per-entity permission
scheme. Exploration since then found that (b) already exists — a generic, YAML-config-driven
permission engine lives at `backend/permissions/` (`EndpointPermission`,
`config/<resource>/endpoints.yml`) and is already used by many resources (`game`, `treasure`,
`game_item`, etc.). This issue is therefore scoped to just (a): the module extraction, reusing
the existing permissions engine rather than building a new one.

The upload plumbing currently lives entirely inside `games/` despite being genuinely cross-app.
`miniatures` views (`source_photo_upload.py`, `stl_model_photo_upload.py`,
`collection_photo_upload.py`) import all of it from `games`, which is a backwards dependency — a
`games`-owned module being required by `miniatures`. That's the main motivation for the
extraction, not just naming/organization.

What lives in `games/` today despite being shared:

- `games/models/upload.py` — the `Upload` model (GenericForeignKey-based), with 3 migrations
  behind it (create + 2 alters)
- `games/views/_upload_init.py` — `UploadInitiator`, the shared init-endpoint helper
- `games/photo_path.py` — `PhotoPathBuilder`
- `games/views/upload_finalize.py` — the finalize endpoint plus its `_PHOTO_HANDLERS` dispatch
  registry (`permission_check`, `mark_ready`) per content-object type
- `games/urls/uploads.py` — already an isolated 5-line URL module for the finalize endpoint

Unlike the original issue #1066, this refactor is **not** scoped to photos only. File uploads
(`GameDocumentFile` / `GameDocumentFilePhoto`) already live in the same `_PHOTO_HANDLERS`
registry as the photo handlers, so splitting the module by photo-vs-file would add complexity for
no benefit — both should move together.

## What needs to be done

Backend:

- Create a new, neutral `uploads` Django app.
- Move the shared engine into `uploads`:
  - `Upload` model (from `games/models/upload.py`)
  - `UploadInitiator` (from `games/views/_upload_init.py`)
  - `PhotoPathBuilder` (from `games/photo_path.py`)
  - the `upload_finalize` view and its `_PHOTO_HANDLERS` registry (from
    `games/views/upload_finalize.py`), covering both photo and file upload handlers
  - the uploads URL module (from `games/urls/uploads.py`)
- Add a `SeparateDatabaseAndState` migration pair to move `Upload`'s database table state from
  `games` to `uploads` without touching the actual DB table or its data (state-only move — no
  data risk, since upload records are short-lived/expiring, not durable data). Carry over the
  existing 3 migrations' history correctly so the new app's migration graph reflects the model's
  real history.
- Leave the ~13 thin per-entity init view files in their owning apps (`games/`: photo/item/
  treasure/document photo & file uploads; `miniatures/`: source/stl_model/collection photo
  uploads); update them to import `UploadInitiator`, `PhotoPathBuilder`, etc. from `uploads`
  instead of `games`.
- Update `games/urls/uploads.py`'s callers (wherever the uploads URL module is wired into the
  root URLconf) to point at the new `uploads` app's URL module.
- Update the ~15 backend test files that import these moved modules to use the new `uploads`
  import paths.
- Register the new `uploads` app in Django settings (`INSTALLED_APPS`) as needed.

Docs:

- Update `docs/agents/architecture.md` (and any other `docs/agents/` file referencing the old
  `games`-owned upload module locations) to reflect the new `uploads` app.

## Acceptance criteria

- [ ] A new `uploads` Django app exists, containing the `Upload` model, `UploadInitiator`,
      `PhotoPathBuilder`, the `upload_finalize` view with its full `_PHOTO_HANDLERS` registry
      (both photo and file handlers), and the uploads URL module.
- [ ] `games/models/upload.py`, `games/views/_upload_init.py`, `games/photo_path.py`,
      `games/views/upload_finalize.py`, and `games/urls/uploads.py` no longer exist; their
      former contents live only in `uploads`.
- [ ] A `SeparateDatabaseAndState` migration pair moves `Upload`'s state from `games` to
      `uploads` with no changes to the underlying database table and no data loss.
- [ ] No module in `miniatures/` imports upload plumbing from `games/`; all such imports come
      from `uploads` instead.
- [ ] All per-entity init views in `games/` and `miniatures/` that previously imported from
      `games`'s upload modules now import from `uploads` and continue to work unchanged from the
      client's perspective (same request/response contract).
- [ ] All backend tests (including the ~15 files with import-path updates) pass under
      `docker-compose run backend poetry run pytest`.
- [ ] `docs/agents/architecture.md` reflects the new `uploads` app and its ownership of the
      shared upload engine.
