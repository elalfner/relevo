# Proposal

## Why

`declared-review-adapter` lets a repository declare an `api` review adapter in its own profile, and leaves out that the plugin ships one. A repository with a Nhost backend (Postgres, Hasura, Auth and functions in the containers of one Docker Compose project) must still write `adapter`, `needs`, `log` and `test` itself. The owner wants both: the mechanism, and a `nhost` stack that works with no `review` block and that the repository can still override.

## What Changes

- **A `nhost` stack ships with the plugin**: `stacks/nhost.md` (no targets, `interface: none`) and an entry `nhost/-` in the adapter table, so a platform with stack `nhost` reviews with no `review` block.
- **The adapter is the generic `api` one of `declared-review-adapter`** (generic preflight, `compose:` log, `declared` audit, the person's written word before the agent runs anything), with defaults from the profile: `needs: [docker, npm]`, `log: compose:` (every service), `test: npm run --silent test` with no `{filter}`.
- **The repository overrides `log` and `test`** in its own `.relevo/stacks/nhost.md`, as it does for `laravel` and `supabase`. `needs` and `adapter` stay the plugin's.
- **Same guards as a declared adapter**: the local rule on `test` and `log` also applies to the shipped Nhost profile.
- `docs/stacks.md` and `docs/stacks.es.md` list `nhost`; the stop message names it among the adapters that exist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the plugin ships the `api` adapter for `nhost`.
- `platforms`: the plugin ships the profile `nhost`.
- `init-doctor`: `doctor` and `init` treat `nhost` as a shipped stack with a generic `api` adapter.

## Impact

- Code: `scripts/lib/review-adapters.mjs`, `scripts/review-adapter.mjs`, `scripts/lib/stack-profile.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, new `stacks/nhost.md`; tests that list the shipped stacks.
- Documentation: `docs/stacks.md`, `docs/stacks.es.md`.
- Depends on `declared-review-adapter` (its code is the base of this branch, and it is archived with its specs synced). It rewrites no requirement that change modified.
- Out of scope: a Nhost CLI flow (`nhost up`), starting or seeding the instance, a per-test filter, a `device` or `browser` review of this stack.
- Breaks: a repository with its own full `.relevo/stacks/nhost.md` (the one that motivates this) now gets the plugin's profile underneath. Its `commands` that differ are ignored with a `doctor` warning, so they move to `checks` in `relevo.yml`.
