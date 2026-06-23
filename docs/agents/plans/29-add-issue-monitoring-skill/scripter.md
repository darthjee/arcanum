# Scripter Plan: Add Issue Monitoring Skill

Main plan: [plan.md](plan.md)

## Shared contracts

- **`_lib/tags.sh`** (this agent writes it): exposes `extract_tags <text>` and `has_tag <text> <tag>` — see plan.md for full signatures.
- **`monitor-issues/scripts/monitor_issues.sh`** (this agent writes it): invoked with no args from `SKILL.md`, blocks forever.
- **`.claude/state/issues.json`** schema: `{"<id>": {"updated_at": "<ISO8601>", "tags": ["<tag>", ...]}}`.
- **`.claude/state/issue-monitor-last-checked.txt`**: raw ISO8601 timestamp, written at the start of each round minus 1 second.

## Implementation Steps

### Step 1 — Create `_lib/tags.sh`

Create a new top-level `_lib/` directory and `_lib/tags.sh` with two functions:

**`extract_tags <text>`**: scan `<text>` for all occurrences of the pattern `:word:` (where `word` is `[A-Za-z0-9_+]+`), strip the surrounding colons, and print each unique tag name on its own line. Case-sensitive extraction, but `has_tag` comparison is case-insensitive.

**`has_tag <text> <tag>`**: call `extract_tags` on `<text>`, then `grep -qi` for `^<tag>$`. Exit 0 if found, exit 1 if not.

The file must have a shebang-less header (it is sourced, not executed) and a guard against double-sourcing:
```bash
[[ -n "${_LIB_TAGS_LOADED:-}" ]] && return 0
_LIB_TAGS_LOADED=1
```

### Step 2 — Update `auto-fix-all/scripts/has_shipit_tag.sh` to delegate to `_lib/tags.sh`

The existing script duplicates tag-parsing logic. After `_lib/tags.sh` exists, update `has_shipit_tag.sh` to:
1. Source `_lib/tags.sh` (relative path from the script: `../../../../_lib/tags.sh` — the script is at `auto-fix-all/scripts/`, the lib is at `_lib/` at the repo root, so the relative path from the script file is `../../_lib/tags.sh`).
2. Read the issue file and call `has_tag "$(cat "$file")" "shipit"` — or keep reading the tags line and delegating to `has_tag`.
3. Keep the same CLI contract: `has_shipit_tag.sh <issue_file>`, exits 0 if `:shipit:` is present, exits 1 otherwise.

Preserve the existing behavior exactly — only the implementation changes, not the interface.

### Step 3 — Create `monitor-issues/scripts/_lib_origin.sh`

Copy `auto-fix-all/scripts/_lib_origin.sh` verbatim into `monitor-issues/scripts/_lib_origin.sh`. Per project convention each skill is self-contained; there is no cross-skill sourcing of origin helpers. Update the comment at the top to say it is local to the `monitor-issues` skill.

### Step 4 — Create `monitor-issues/scripts/monitor_issues.sh`

Main monitoring loop. Full behavior:

```
set -euo pipefail
source _lib_origin.sh
source ../../_lib/tags.sh

STATE_DIR=".claude/state"
ISSUES_FILE="${STATE_DIR}/issues.json"
LAST_CHECKED_FILE="${STATE_DIR}/issue-monitor-last-checked.txt"
LOCK_FILE="${STATE_DIR}/issue-monitor.lock"

Ensure $STATE_DIR exists.

_acquire_lock / _release_lock: same pattern as queue.sh (write instance ID, sleep 1s, re-read; retry with warning after 10 attempts).

_read_issues: cat ISSUES_FILE or echo '{}'.
_write_issues <json>: write to ISSUES_FILE atomically (write to .tmp, then mv).
_read_last_checked: cat LAST_CHECKED_FILE or echo "1970-01-01T00:00:00Z".

Loop forever:
  1. Record now-1s as POLL_START (using `date -u -v-1S +%FT%TZ` on macOS, `date -u -d '-1 second' +%FT%TZ` on Linux — detect via `uname`).
  2. Write POLL_START to LAST_CHECKED_FILE.
  3. Read LAST_CHECKED_FILE to get SINCE (the previous round's saved time, not the one just written).
     Wait — the logic is: save the current timestamp BEFORE fetching, so issues updated while we parse are captured next round. So:
       a. SINCE = _read_last_checked (the value saved at the START of the PREVIOUS round)
       b. NOW_MINUS_1 = current time minus 1 second
       c. Write NOW_MINUS_1 to LAST_CHECKED_FILE (for the next round)
       d. Fetch issues updated since SINCE
  4. Fetch issues from GitHub:
       gh issue list -R <REPO_REF> \
         --author <GH_USER> \
         --state all \
         --json number,title,updatedAt,body,labels \
         --search "updated:>$SINCE" \
         --limit 100
     On gh error: log to stderr, sleep 5, continue.
  5. For each issue in the response:
       a. ISSUE_ID = .number (as string)
       b. GH_UPDATED_AT = .updatedAt
       c. STORED_UPDATED_AT = read from issues.json[ISSUE_ID].updated_at (or "1970-01-01T00:00:00Z" if missing)
       d. If GH_UPDATED_AT <= STORED_UPDATED_AT: skip (log "skipping #ID — not newer").
       e. Otherwise:
            - BODY = .body
            - TAGS = extract_tags "$BODY" (as a JSON array: jq -R . | jq -s .)
            - NOW = current time (ISO8601)
            - Acquire lock
            - Read issues JSON
            - Merge: issues[ISSUE_ID] = {"updated_at": NOW, "tags": TAGS}
            - Write issues JSON
            - Release lock
            - Log "processed #ID — tags: <TAGS>"
  6. Sleep 5.
```

Key implementation notes:
- Use `jq` for all JSON reads/writes.
- The `--search "updated:>$SINCE"` GitHub filter handles the coarse filter; the per-issue `updated_at` comparison is the fine-grained guard.
- Always release the lock in a trap to avoid leaving it behind on exit.
- Log with a timestamp prefix for observability: `[$(date -u +%FT%TZ)] <message>`.

## Files to Change

- `_lib/tags.sh` — create new shared tag-parsing library (new file, new directory)
- `auto-fix-all/scripts/has_shipit_tag.sh` — delegate to `_lib/tags.sh` instead of duplicating logic
- `monitor-issues/scripts/_lib_origin.sh` — copy of origin helpers, local to this skill
- `monitor-issues/scripts/monitor_issues.sh` — main monitoring loop

## Notes

- The `_lib/` directory lives at the project root, not inside any skill folder. Relative path from `<skill>/scripts/` to `_lib/tags.sh` is always `../../_lib/tags.sh`.
- The macOS/Linux date command difference (`-v-1S` vs `-d '-1 second'`) must be handled in the script via `uname`.
- Keep `has_shipit_tag.sh`'s public interface unchanged — only the internals change.
- Do not add tag-based actions (like auto-queueing) — that is explicitly out of scope for this issue.
