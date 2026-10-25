# Register the spec and check links

Add one row to the table in `docs/agents/specs.md` for the index only:

```
| [CLI Install](specs/cli-install.md) | Install and update `arcanum-cli` together with arcanum, plus `arcanum self-update`. | Proposed |
```

Then check that every relative link in the five new files and in the new row resolves to an existing file, for example with a quick script over the markdown links.

## Files to Change

- `docs/agents/specs.md`: add the row.
