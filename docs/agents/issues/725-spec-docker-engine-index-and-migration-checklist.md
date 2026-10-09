# Issue: Spec: docker engine index and migration checklist

## Description

Part of epic #724 (implement `engine.mode=docker`). See the epic for scope, the fallback rule (entrypoint not docker-ready or Docker unavailable → `engine_dispatch.sh` falls back internally to native on the host with a stderr warning), and the open points.

Create the entry point of the docker spec (`docs/agents/specs/docker.md`), the migration checklist that tracks the rest of the epic (`docs/agents/specs/docker/checklist.md`), and a permanent index of all specs (`docs/agents/specs.md`).

Owner: **architect**. Docs-only.

## Problem

The docker epic needs a single place to record its design and to track, per script, which ones already run under `engine.mode=docker`. Today `docs/agents/specs/` only supports flat single-file specs and has no index, and nothing lists which scripts are routed through `engine_dispatch.sh` (and so can run in docker) versus which are not.

## Expected Behavior

- `docs/agents/specs/docker.md` exists as the docker spec index, with stub parts under `docs/agents/specs/docker/` so every link resolves.
- `docs/agents/specs/docker/checklist.md` lists every script (one row per dispatch command, plus a section for scripts not routed through dispatch), all starting ☐, ready for each implementation PR to tick its own rows.
- `docs/agents/specs.md` lists every current spec and stays after the epic ends.
- The split-spec folder convention is documented in `AGENTS.md` and `docs/agents/folder-structure.md`.

## Solution

### Scope

- `docs/agents/specs/docker.md` — index: status, goal, links to each `docs/agents/specs/docker/*.md` part, and the map of epic sub-issues.
- `docs/agents/specs/docker/checklist.md` — one row per entrypoint: every dual entrypoint in `arcanum/_lib/migration-status.json` plus every native-only command (`--native-only` shims). Columns: see [Checklist columns](#checklist-columns). All rows start ☐.
- The checklist is **hand-maintained**: every implementation sub-issue ticks its own rows in the same PR.
- **Stub files** for `docs/agents/specs/docker/{image,mounts,environment,dispatch,testing}.md`: title plus "to be written in #726/#727", so every link from the index resolves.
- **Specs index:** add `docs/agents/specs.md`, a permanent index of every current and future spec (one entry per spec: link, one-line summary, status). Seed it with `shell-engine-removal.md` and `docker.md`. It is **not** removed at the end of the epic. Only the docker entry is (removed/repointed by #731/#732). Link it from `AGENTS.md`'s docs table and Specs section.
- **Folder convention:** document in `AGENTS.md` (Specs section) and `docs/agents/folder-structure.md` that a large spec may be split as `docs/agents/specs/<topic>.md` (index) + `docs/agents/specs/<topic>/*.md` (parts), and that every spec is listed in `docs/agents/specs.md`.
- **Drift rule in agent files (temporary):** add a line to `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`: while epic #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` must update `docs/agents/specs/docker/checklist.md`. #731 removes these lines.
- **Links:** link the new spec from `docs/agents/specs/shell-engine-removal.md` (docker-mode prerequisite) and add one line to `docs/agents/architecture/script-engine.md`'s "See also". #731 repoints both.

### Out of scope

- The content of the other spec parts (image, mounts, environment, dispatch, testing) — separate sub-issues; only stub links here.
- Any code or config change, including `arcanum/_lib/migration-status.json`.
- The docker-readiness source of truth that dispatch reads: decided in #727.

### Index content

`docs/agents/specs/docker.md` sections, following the style of `docs/agents/specs/shell-engine-removal.md`:

1. **Status**: proposed / in progress, links to epic #724 and `docker/checklist.md`; updated as phases complete.
2. **Goal**: `engine.mode=docker` runs arcanum's scripts inside a container instead of on the host.
3. **Decisions so far**, summarized from #724:
   - scope in/out (no top-level `scripts/`, no shell-engine removal, no Claude Code in docker);
   - fallback rules: entrypoint not docker-ready → native (→ shell if no native); Docker unavailable → native; both handled internally by `engine_dispatch.sh` with a stderr warning;
   - the checklist is hand-maintained; each PR ticks its own rows.
4. **Security principles** (see [Performance & security](#performance--security) below).
5. **Parts**: table of each `docker/*.md` part, one-line purpose, and the issue that writes it (#725, #726, #727, #733).
6. **Sub-issue map**: #725–#733 in dependency order, with owner and status.
7. **Open points**, each pointing at the part/issue that resolves it: TTY, performance (`docker run` vs. `docker exec`), docker-readiness source of truth, worktrees, credentials, platforms, non-dispatched scripts (#733), etc.
8. **Maintenance rule (drift)**: while #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` updates `docker/checklist.md`.
9. **See also**: `docs/agents/architecture/script-engine.md`, `docs/agents/specs/shell-engine-removal.md`, `docs/agents/architecture/entrypoint-migration-status.md`, `docs/agents/specs.md`.

No "Prerequisites" or "Auto-detection" sections (not applicable here). The doc never hardcodes entrypoint counts.

### Checklist row granularity

- **One row per dispatch command**: each key of `arcanum/_lib/migration-status.json` plus each native-only command name. This matches what `engine_dispatch` receives, and therefore what the docker-readiness lookup (#727) keys on. Per-subcommand routers (e.g. `auto-fix-all/scripts/github.sh` → `auto-fix-all-github-pr-number`, `-pr-merge`, `-has-label`, …) produce several rows sharing one script.
- A `script` column gives the shim path (plus subcommand, where relevant).
- **One table per skill folder** (`## arcanum/_lib`, `## auto-fix-all`, `## discuss-issue`, …), so a batch PR touches a single section. Native-only commands sit in their skill's table with `kind = native-only`.
- A final section, **"Not routed through dispatch (pending #733)"**, has one row per script **file**, since those scripts have no command name.

### Checklist columns

| # | Column | Values |
|---|---|---|
| 1 | `command` | dispatch command name (file name for the "not routed through dispatch" section) |
| 2 | `script` | shim path (+ subcommand where relevant) |
| 3 | `kind` | `dispatched` / `native-only` / `TBD (#733)` |
| 4 | `status` | ☐ / ✅ / `blocked (no native)` / `n/a` |
| 5 | `credentials` | `none` / `gh` / `git-push (ssh)` / `?` |
| 6 | `mounts` | extra paths beyond the repo, each tagged `ro`/`rw` (e.g. `CLAUDE_CONFIG_DIR:rw`); `?` until #726 |
| 7 | `env` | extra env vars beyond the command's existing allowlist |
| 8 | `issue` | issue that made the command docker-ready |
| 9 | `notes` | free text (e.g. TTY-owning, slow) |

The repo mount is implicit for every row.

### Initial population

- Generate the skeleton rows with a **one-off snippet** (a `jq` over `arcanum/_lib/migration-status.json` plus a `grep` of `engine_dispatch` calls in the shims under `<skill>/scripts/` and `arcanum/_lib/`), run once while writing the doc. The snippet goes in the PR description, not in the repo: the checklist is temporary and hand-maintained afterwards. No committed generator script.
- Initial column values (see [Checklist columns](#checklist-columns)):

  | Column | Initial value |
  |---|---|
  | `command`, `script`, `kind` | generated |
  | `status` | ☐ for every row (`blocked (no native)`: none today — every key in `migration-status.json` is `true`) |
  | `credentials` | derived from each `engine_dispatch` call's env allowlist (e.g. `HOME` forwarded → `gh`), then reviewed by hand; uncertain rows `?` |
  | `mounts` | `?`, filled in by #726 |
  | `env`, `issue`, `notes` | empty |

- The "Not routed through dispatch (pending #733)" section lists every remaining `*.sh` under `<skill>/scripts/` and `arcanum/_lib/` (excluding `*_shell.sh` twins and `test_*`), plus `arcanum/install/*` and `arcanum/update/*`, with `kind = TBD (#733)`.

### Edge cases

- **Scripts not routed through `engine_dispatch.sh`** (sourced libraries, thin per-skill wrappers, non-dispatched entrypoints such as `next_step_prompt.sh`, install/update bootstraps): how they are handled under docker is decided in #733. This issue only lists them in `checklist.md` under a "pending #733" heading (or a **kind** column left `TBD (#733)`), so the checklist still covers every script.

### Performance & security

The issue itself is docs-only, but the index and checklist shape how later sub-issues handle both:

#### Security

- **Checklist column `credentials`:** per command, `none` / `gh` / `git-push (ssh)` — tells #726 exactly which commands need a token or SSH agent forwarded, so credentials are only exposed to the commands that need them (consistent with the per-command env allowlist).
- **Checklist column `mounts`:** per command, the extra paths it needs, each tagged `ro`/`rw` (e.g. `CLAUDE_CONFIG_DIR:rw`). Writes outside the repo show up as `rw` mounts; everything else is read-only.
- **Index section "Security principles"**, binding on the other spec parts:
  - mount the minimum, read-only by default;
  - never bake tokens into the image or pass them as command-line arguments (env or mounted config only);
  - the container runs as the host uid, not root;
  - no `--privileged`, no Docker socket mount.

#### Performance

- **Index open point "Performance"** for #727: `docker run` adds startup overhead (≈0.3–1s, more on macOS Docker Desktop) and a single skill run makes many script calls (worse in `auto-fix-all` loops). #727 decides per-call `docker run` vs. a long-lived container + `docker exec`, against a rough acceptance target (e.g. < 1s overhead per call on Linux), benchmarking a few hot scripts.
- No per-script "calls per run" column (not worth the upkeep).

### Other concerns

- **Backward compatibility / migration:** none. Docs-only, with no behavior, config or per-repo migration change.
- **Testing:** every link in `docker.md`, `specs.md`, `AGENTS.md` and `folder-structure.md` resolves (including the stub parts); the checklist's dispatch rows match the one-off snippet's output (every `migration-status.json` key plus every native-only command appears exactly once).
- **Folders:** `docs/agents/specs/docker/` lives under an existing architect-owned folder; no new root-level folder.

## Benefits

- One tracking tool for the whole epic: progress is visible per command, and each batch PR touches one table section.
- The `credentials` and `mounts` columns let #726 expose secrets and writable paths only to the commands that need them.
- `docs/agents/specs.md` makes current and future specs discoverable, independently of this epic.
