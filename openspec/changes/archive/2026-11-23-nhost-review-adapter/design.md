# Design

## Context

Read in the code of `declared-review-adapter` (its branch is this one's base): `ADAPTERS` in `scripts/lib/review-adapters.mjs` is what "the plugin ships an adapter" means (`hasShippedAdapter`); a plugin profile cannot carry `review.adapter` or `review.needs`; `mergeProfiles` drops them from a repository profile of a shipped stack; `review-adapter.mjs` and `doctor` resolve the profile only for a stack with no table entry; the local rule (`declaredAdapterErrors`), the generic preflight, the `compose:` log and the `declared` audit are tied to `declared: true` or `review.adapter === 'api'`.

## Decisions

### 1. Shipped means a table entry plus a plugin profile

`ADAPTERS['nhost/-']` is `{ kind: 'api', declared: true, capture: null, needs: ['docker', 'npm'] }` and `stacks/nhost.md` has `review: { log: 'compose:', test: 'npm run --silent test' }` and no `adapter` or `needs`, as the plugin profile cannot carry them. `declared: true` keeps its meaning "the generic `api` adapter, defined by the `review` block": the skill, the state and the audit key on it, so nothing there changes. Discarded: `adapter: api` in the plugin profile (a second source of truth, and the rule that a plugin profile cannot carry it).

### 2. `adapterFor` fills the entry from the resolved `review` block

For an entry with `declared: true`, `adapterFor` takes `log`, `test` and `driver` from the `review` argument (plugin defaults plus the repository's override) and keeps `needs` from the table. `review-adapter.mjs` and `doctor` resolve the profile when the stack has no entry or the entry is `declared`. A broken repository profile of `nhost` stops the review with its errors, as for a repository-only stack; `laravel` and `supabase` stay out of that path.

### 3. The local rule follows the entry, not only `review.adapter`

`declaredAdapterErrors` runs when `review.adapter === 'api'` or the stack's entry is `declared` (a small export of `review-adapters.mjs`, which imports nothing from `stack-profile.mjs`). So `log` and `test` of the shipped profile and of a repository override are refused when remote, and `log` and `test` are required (the plugin provides both).

### 4. Defaults, and what is a guess

- `log: compose:` is every service: a named service that the project does not have makes the log unreadable and the verdict inconclusive, so the default names none. A project narrows it (`compose:postgres,graphql,auth,functions`).
- `test: npm run --silent test` and `analyze: npm run --silent analyze` follow the npm convention; the project that motivates this runs `test:integration` and overrides `review.test` and, for the gate, `checks.test`. No `{filter}`: the project runs the suite whole.
- `needs: [docker, npm]` is fixed. A project that needs another tool cannot add it; that is the price of `needs` being the plugin's for a shipped stack.

### 5. The profile body is short

`stacks/nhost.md`: `Verification`, three items each in `Security for the developer` and `Security review` (explicit Hasura permissions per role, Auth and Storage tables not exposed, no admin secret in client code) with source and date as the platforms spec requires, and `Review` (instance started by the person, test data stays, local only, no `.env`). Domain rules of a project stay in its own file, which is appended.

### 6. Doctor and init

`doctor` runs the checks of a declared adapter for `nhost` (tools, `{filter}` note, invalid profile). `init` treats `nhost` as shipped: it proposes no `.relevo/stacks/nhost.md`. Nothing else changes.

## Risks / Trade-offs

- [Both changes edit `adapterFor`, `review-adapter.mjs`, `stack-profile.mjs` and `doctor.mjs`] → this branch starts from the other one's; archive `declared-review-adapter` first and rebase on any later commit there.
- [`declared` now also marks a shipped adapter] → a comment in the table says so; renaming it is a change of the other one's skill and state.
- [The default `test` is a convention guess] → overridable, and `doctor` reports the replaced key.

## Migration Plan

A repository with a full own profile: its `commands` that differ from the plugin's move to `checks` in `relevo.yml` (the `doctor` warning names them). Rollback is removing the table entry and `stacks/nhost.md`.

## Open Questions

- Should the plugin default `test` be `npm run --silent test`, or should the shipped profile name none and make `doctor` warn until the project sets one?
- Should a repository be able to add to `needs` of a shipped generic adapter?
