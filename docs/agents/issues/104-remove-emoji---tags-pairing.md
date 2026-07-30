# Issue: Remove emoji - tags pairing

## Description
Early on, Arcanum skills used emojis embedded directly in an issue's body to define and control issue tags (driving actions, monitoring reactions, and PR-handling behavior). That body-emoji-parsing mechanism has already been removed: issue tag state is now tracked entirely via real GitHub labels (see Fix #90 — "Read/write issue status via GitHub labels instead of body tags").

What remains is a naming vestige of the old system: the canonical tag identifiers used internally throughout the codebase (`pencil2`, `clipboard`, `construction`, `eyes`, etc., defined in `_lib/tags.sh`) are still named after gemoji shortcodes, even though nothing parses actual emojis from issue bodies anymore.

## Problem
The emoji-shortcode naming convention for canonical tags is still baked into `_lib/tags.sh`'s `_tag_label_for`/`_tag_for_label` mapping, and referenced across multiple skills' scripts and docs (`_lib/tag_actions.sh`, `_lib/tag_mutate.sh`, `_lib/github_issue.sh`, `auto-fix-all/`, `auto-monitor-pr/`, `auto-rewrite-issue/`, `monitor-issues/`, and the architecture/folder-structure docs). Every time a new tag/label is introduced, a gemoji shortcode must still be chosen to name its canonical identifier, even though that name no longer serves any emoji-parsing purpose — it is pure incidental hassle.

## Solution
Rename the canonical tag identifiers in `_lib/tags.sh` (and every call site listed above) to plain, descriptive names decoupled from emoji shortcodes — for example `pencil2` → `created`, `clipboard` → `ready_for_work`, `construction` → `working`, `eyes` → `fetched` — while leaving the GitHub label names themselves, and the unrelated PR-comment emoji-reaction and `:shipit:`-comment PR-approval mechanisms, untouched.

## What this issue is not about
- Removing emoji reactions on PR comments
- Removing the `:shipit:` PR-approval-via-comment convention
