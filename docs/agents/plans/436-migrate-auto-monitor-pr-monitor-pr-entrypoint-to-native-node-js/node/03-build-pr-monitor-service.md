# Build a PrMonitor service for the poll/normalize/decide logic

Follow `PrChecker.js`'s precedent (`core/lib/services/PrChecker.js`) — a small, context-free service that takes its collaborators via constructor injection (a `GitHubClient` or `PrOperations`, per Step 02's decision) and exposes one orchestrating method for "one poll attempt", keeping the state-file/CLI concerns entirely out of it (those belong to `AutoMonitorPrMonitorPr` in Step 04).

## Files to Change

- `core/lib/services/PrMonitor.js` (new):
  - Constructor: `{ prOperations, githubClient, safeFetcher = new SafeFetcher() }`-shaped, mirroring `PrChecker`'s DI convention — reuse `SafeFetcher` for the same transient-error-swallows-to-`null` behavior `monitor_pr.sh` gets from its `|| { echo pending; exit 0; }` guards throughout.
  - `async resolveState(prNumber, owner)` — returns `'merged' | 'closed' | 'approved' | null` (null meaning "no terminal state yet, keep going") using `getPrState` + `getPrReviews`, matching lines 166–192 of the shell script (latest-by-`submittedAt` review from `owner`, `APPROVED` → `'approved'`).
  - `async newOwnerComments(prNumber, owner, sinceIso)` — fetches issue comments + inline review comments + review bodies (skipping empty/whitespace-only review bodies, matching line 208's `gsub("[[:space:]]"; "") != ""` filter), normalizes all three to `{login, createdAt, body, id, url}`, filters to `login === owner && createdAt > sinceIso`, and returns them sorted the same way the shell script implicitly processes them (order doesn't affect output correctness — `pr_comments` push order isn't asserted by any caller — but keep it deterministic for the parity test's byte-for-byte stdout comparison; the shell's `jq` array-concatenation order is issue-comments, then inline, then reviews, each in their API response order, so replicate that concatenation order exactly).
  - `isShipit(body)` — the whitespace-tolerant `:shipit:`-only regex test from Step 01.
  - `async addEyes(nodeId)` / `async resolveAddressed(nodeId)` (or similar names) wrapping the `addReaction`/`removeReaction` GraphQL pair from Step 02, one for the fetched→processing transition (add `EYES`) and one for processing→addressed (remove `EYES`, add `THUMBS_UP`) — match lines 150–154's exact two-call sequence (remove then add, not just add).
  - Every method here swallows its own transient errors to `null`/`[]` via `safeFetcher` (or a local try/catch) — nothing here should ever throw except a genuine programming error; `AutoMonitorPrMonitorPr` should never need its own try/catch around calls into this service.

Keep this service ignorant of `.claude/state/*` entirely — it takes `sinceIso` in, returns comments/decisions out, and never reads or writes a state file itself. That split is what makes Step 05's unit tests able to test the decision logic and the state-file persistence independently.
