# Node Plan: Docker engine: migrate TTY-owning native-only commands (batch 5)

Main plan: [plan.md](plan.md)

## Shared contracts

- The shims call `engine_dispatch ... --native-only --needs=global-config,gitconfig,gh HOME -- "$@"` with no `--path-arg` (scripter step 1).
- Docker routing cases assert: global-config file `:ro`, global gitconfig `:ro`, `GH_TOKEN` by name only, repo mounted at its own path, no `-t`.
- Exit-4 contract: `FALLBACK=chat` (+ `DRAFT=` lines for `start`), exit 4. Unchanged.

## Steps

- [01 — Flip both commands to docker](node/01-flip-status.md)
- [02 — Docker routing cases](node/02-routing-cases.md)
- [03 — Docker parity cases](node/03-parity-cases.md)

## CI Checks

- `core/`: `make core-test` / `make core-lint` (Jasmine + ESLint, as in the core CI jobs).
- Parity: `make docker-parity`, run locally. Report the platform in the PR.

## Notes

- `start` runs `GithubPreflight` before anything else: `origin` must be a `github.com` remote and a token must be obtainable. Fixtures need a GitHub-style origin URL and a seeded `GH_TOKEN`. If preflight turns out to need network, move those cases to the opt-in gh sandbox helper (`itMatchesNativeInDockerWithGh`) and say so in the PR.
- macOS has no `setsid` binary. Detach with Node's `spawn(..., { detached: true, stdio: [...] })`, which calls `setsid()`, so this works on both platforms.
