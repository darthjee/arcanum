# Add GitHub label operations

Add `core/lib/utils/github/GitHubLabelClient.js` on the shared `GitHubTransport`, following `GitHubChecksClient`/`IssueClient`:

- `listLabelNames()`: paginates `GET /repos/<repo>/labels?per_page=100&page=N` until a page returns fewer than 100 items, and returns the names.
- `createLabel(name, color)`: `POST /repos/<repo>/labels {name, color}`.
- `updateLabel(existingName, name, color)`: `PATCH /repos/<repo>/labels/${encodeURIComponent(existingName)} {new_name: name, color}`.

Each failure message names the repo ref, as the existing clients do. Expose the three methods on the `GitHubClient` facade and update its doc comment listing.

## Files to Change
- `core/lib/utils/github/GitHubLabelClient.js` — new
- `core/lib/utils/github/GitHubClient.js` — wire in and delegate
