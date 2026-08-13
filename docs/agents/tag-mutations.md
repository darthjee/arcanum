# GitHub Issue Tag Mutations

<!-- AUTO-GENERATED, DO NOT EDIT BY HAND. Run scripts/generate_tags_table.sh to refresh. -->

One row per call site, across all skills, that mutates a GitHub issue tag/label — both the semantic `mark-*` wrappers and the generic `add-tag`/`remove-tag` calls. Both mechanisms bottom out in the shared `arcanum/_lib/tag_mutate.sh` helpers (not repeated per row below). `shipit` is out of scope — it is human-only and never mutated by any script. See [architecture.md](architecture.md) for the narrative version.

| Skill | Step | Entrypoint | Tags Added | Tags Removed |
|-------|------|------------|------------|--------------|
| arcanum-split-issue | 1 (fetch.md) | `arcanum-split-issue/scripts/github.sh` | planning | idea,writting,created |
| auto-fix-all | 2 (process_one_issue.md) | `auto-fix-all/scripts/github.sh` | fetched | - |
| auto-fix-all | 2 (process_one_issue.md) | `auto-fix-all/scripts/github.sh` | - | fetched |
| auto-fix-all | 2 (process_one_issue.md) | `auto-fix-all/scripts/github.sh` | working | - |
| auto-rewrite-issue | (run.md) | `monitor-issues/scripts/github.sh` | - | created |
| discuss-issue | 2 (discuss_and_save.md) | `discuss-issue/scripts/github.sh` | refined | created,idea,writting |
| discuss-issue | 2 (discuss_and_save.md) | `discuss-issue/scripts/github.sh` | ready | refined |
| enhance-issue | 1 (fetch.md) | `enhance-issue/scripts/github.sh` | enhancing | idea,writting |
| enhance-issue | 4 (publish.md) | `enhance-issue/scripts/github.sh` | created | idea,writting,enhancing |
