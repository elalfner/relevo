# Proposal

## Why

The lens evaluation of 2026-11-06 (`docs/lens-evaluation.md`) ran the lenses with the cheaper models that `model: auto` can pick. Sonnet passed for `spec` and `security` (7/7 found, 0 good variants flagged). Haiku found the seeded defects of `code` and `interface` but also flagged 2 of 4 clean changes, which sends correct work back to the developer. With the default floor (one step below the ceiling) `auto` could put `code` and `interface` on haiku.

## What Changes

- The default floor of a QA lens on `auto` is never below `sonnet`: it is the name one step below the ceiling, but not lower than `sonnet` when `sonnet` is in the ladder and not above the ceiling. The developer keeps the floor one step below its ceiling.
- A `floor` written in `relevo.yml` is still obeyed.

## Capabilities

### Modified Capabilities
- `configuration`: the default range of a QA lens.

## Impact

- Changed: `scripts/lib/config.mjs`, `docs/configuration.md`, `docs/configuration.es.md`, `docs/lens-evaluation.md`, `CHANGELOG.md`, tests of config and model plan.
