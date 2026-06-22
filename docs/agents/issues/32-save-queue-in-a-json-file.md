# Issue: Save queue in a json file

## Description
The queue used by `auto-fix-all` is currently persisted as a plain text file. We need to switch this persistence to a JSON file instead.

## Problem
- The `auto-fix-all` queue is stored as plain text, which limits the structure of the data it can hold.
- In the future, more information will need to be tracked per queue entry (e.g. issue metadata or `auto-fix-all` options), which a flat text format can't represent well.

## Expected Behavior
- The queue should be persisted in a JSON file instead of a text file.
- The JSON structure should be extensible enough to support additional fields per entry in the future (e.g. issue details, options).

## Solution
- Identify where the queue is currently read from and written to as text.
- Replace the text-based storage with a JSON file format.
- Ensure existing queue operations (push, pop, list) are updated to read/write JSON.

## Benefits
- Enables storing richer information about each queued issue (details, options) going forward.
- More structured and reliable than parsing plain text.

---
See issue for details: https://github.com/darthjee/arcanum/issues/32
