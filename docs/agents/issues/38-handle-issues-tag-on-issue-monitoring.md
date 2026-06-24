# Issue: Handle Issues Tag on Issue Monitoring

## Description
The issue monitoring skill currently reads tags from the GitHub issue body, but the tag processing logic is not centralized. This issue tracks extracting the tag processing into a shared script so it can be reused consistently across skills.

## Problem
- Tag parsing logic is embedded in the issue monitoring skill rather than in a shared, centralized script
- Tags stored in the issue JSON need consistent handling across multiple skills
- No single place owns the tag-action mapping, making it hard to extend or reuse

## Expected Behavior
- Tag processing is extracted into a standalone script in a common location
- All skills that need to read, parse, or act on tags import from that shared script
- The tag-to-action mapping is defined once and applied consistently

## Solution
- Extract tag parsing and processing into a dedicated script
- Tags are read from the issue body (e.g. `Tags:` line) and stored in the issue JSON
- Each tag drives a specific action, and must be recognized in both emoji and colon-string form (e.g. `❓` and `:question:`):
  - ❓ / `:question:` — Questions for the agent; the tag is removed once the agent answers
  - ✏️ / `:pencil2:` — Issue is ready to be read and rewritten by the agent; tag removed after rewrite and GitHub update
  - 📋 / `:clipboard:` — Issue is ready to be pushed to the auto-fix queue; agent reads, updates JSON, and pushes
  - `:shipit:` — PR is pre-approved (already implemented)
- Keep as much of the tag and issue parsing logic in the script layer as possible

## Benefits
- Centralizes tag logic, reducing duplication across skills
- Makes it easier to add new tags or change existing tag behavior in one place
- Improves testability of tag processing

---
See issue for details: https://github.com/darthjee/arcanum/issues/38
