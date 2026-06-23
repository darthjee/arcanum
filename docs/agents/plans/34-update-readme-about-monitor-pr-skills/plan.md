# Plan: Update Readme About Monitor PR Skills

Issue: [34-update-readme-about-monitor-pr-skills.md](../issues/34-update-readme-about-monitor-pr-skills.md)

## Overview

Add entries for `auto-monitor-pr` and `auto-monitor-issue-pr` to the skills table in `README.md`, following the same format already used for every other skill.

## Context

The README lists all available skills in a markdown table. The `auto-monitor-pr` and `auto-monitor-issue-pr` skills were added without updating that table, leaving users unaware of them unless they browse the folder structure directly.

## Implementation Steps

### Step 1 — Add `auto-monitor-pr` row to the skills table

Insert a new row for `/auto-monitor-pr` in the `## Available skills` table in `README.md`. Description (from `SKILL.md`): "Monitors a given PR for merge/close/approval/new owner comments, blocking until one of those occurs, then reports the outcome. Tracks each owner comment's open/addressed lifecycle with :eyes:/:+1: reactions on the comment itself, but leaves deciding how to address a comment to the caller."

### Step 2 — Add `auto-monitor-issue-pr` row to the skills table

Insert a new row for `/auto-monitor-issue-pr` in the same table. Description (from `SKILL.md`): "Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by `auto-fix-all`."

Keep the two new rows adjacent to the other `auto-*` skills for logical grouping.

## Files to Change

- `README.md` — add two rows to the `## Available skills` table for `auto-monitor-pr` and `auto-monitor-issue-pr`

## Notes

- No script changes, no SKILL.md changes — pure documentation update.
- Match the link format `[`/skill-name`](skill-name/)` used by existing rows.
