# Issue Enhancement

A checklist of concerns to consider when fleshing out a vague issue idea (tagged `Idea`/`Writting`) before it reaches the `Created` stage. Not exhaustive — adjust or extend the list for this project's needs.

- **Scope boundaries** — what's explicitly in scope and what's explicitly out.
- **Alternative solutions** — other ways to solve the same problem, and why this one was chosen.
- **Edge cases** — inputs, states, or timing the happy path doesn't cover.
- **Backward compatibility** — whether this breaks existing behavior, data, or integrations.
- **Testing strategy** — how the change will be verified.
- **Performance & security considerations** — anything relevant to load, latency, or attack surface.
- **Migration needed?** — does this change require a migration script under `arcanum/migrations/repos/<version>/` so repos that already installed arcanum can catch up (e.g. a config file shape change, a renamed/moved file)? If so, note it so the migration ships in the same version as the change it belongs to.
- **Script-driven interaction?** — does this change involve a skill that prompts the user for confirmation/selection, or calls multiple of its own scripts in sequence? If so, prefer a single master script that owns the whole interactive flow via `/dev/tty` (not chat-mediated Y/N), taking the repo path as an explicit argument rather than relying on ambient cwd. See `arcanum-migrate` for the reference implementation.
