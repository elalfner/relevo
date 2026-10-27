---
stack: vue
commands:
  analyze: npx --no-install vue-tsc --build && npx --no-install eslint . --cache
  test: npx --no-install vitest run
  format: npx --no-install prettier --write src/
generated: ['dist/**', '*.tsbuildinfo', 'src/auto-imports.d.ts', 'src/components.d.ts']
tools: [node, npm]
requires_skills: []
skills:
  dev: []
  qa: []
  issue: []
  review: []
targets:
  web: ""
---

# Vue

## Verification

Run the commands of this profile from the folder of the platform: `analyze` (type check, then linter), `test` and `format`. They use the versions pinned in the project (`npx --no-install`), so the dependencies must be installed; if they are not, say so instead of installing anything new. Only the review may install them: it offers the frozen install of the project's lock file (`npm ci --ignore-scripts`) and runs it on a yes.

Do not claim the code type-checks, lints or passes tests unless you ran the commands and saw the result. The commands written here are read-only on purpose: the `lint` script that `npm create vue` generates uses `--fix` and rewrites files, so do not run `npm run lint` as a check. Only `format` writes.

`npm install` of a fresh `create-vue` project can fail on npm 10 with `Cannot read properties of null (reading 'edgesOut')`; installing with `--legacy-peer-deps` works. Say so if you meet it; do not change `package.json` to get around it.

If the project uses `oxlint`, `pnpm` or `yarn`, or names its checks differently, the repository replaces the command with `platforms.<name>.checks` in `relevo.yml`; do not change the profile.

## Hygiene for the developer

- Do not copy `props` or a reactive object into plain variables if they must stay reactive (`const { count } = props` loses it); use `toRefs` / `toRef`, destructure inside `defineProps` (Vue 3.5), or access them through the object.
- Remove what you add outside the component: listeners (`addEventListener`), timers, observers and subscriptions, in `onUnmounted` or `onScopeDispose`.
- Give every `v-for` a stable `:key` that is not the index when the list can change.
- Do not use `v-html` with data that does not come from the code itself. If rich text is needed, sanitise it first and say so.
- Give every screen that loads data a loading, an empty and an error state.
- Prevent a double submit: disable the action while the request is in flight.
- Type props and emits (`defineProps<...>()`, `defineEmits<...>()`); avoid `any`.
- Keep side effects out of `computed`; use `watch` or an event handler.
- Write a Vitest test for each scenario the DOM can show, with `@vue/test-utils`. A scenario that depends on the real browser (layout, animation, a real network) is covered by correct code and verified in the review.

## What the auditor looks for in the diff

Run on a fresh project (`create-vue` with TypeScript, Vitest, ESLint and Prettier), `analyze` fails on a type error, a `v-for` without `:key`, `v-if` with `v-for` on the same element, an unused variable, an explicit `any` and a single-word component name. It does **not** fail on the items below, so they are for the auditor to find by reading the diff:

- **Reactivity**: props or reactive state copied into plain variables (`const { count } = props`) and then used as if reactive; a `ref` read without `.value` in script.
- **Cleanup**: a listener, timer or subscription created and never removed.
- **Lists**: the index used as `:key` on a list that reorders.
- **Unsafe output**: `v-html` with outside data; a URL built from user input and used in `href` or `window.location`.
- **States**: missing loading, empty or error state; an action that can be sent twice.
- **Types**: `as` casts that hide a mismatch, an event or prop that the component does not declare.
- **Network**: a request with no error handling; a token or secret written in the code.
- **Generated code**: leave `dist/`, `*.tsbuildinfo` and generated declaration files out of the review.

Do not spend time re-checking what `analyze` already enforces: read its output.

## Targets

- `web`: needs a browser; no extra tool. The review of a web target is always driven by the agent (`review.autopilot` must be `precheck` or `verify`) with a Playwright script that `qa` reads first; Playwright is a development dependency of the project: `/relevo:init` offers to add it (`npm install -D playwright`) and its Chromium (`npx playwright install chromium`), and the review never installs Playwright itself.

## Questions for the issue writer

- Which screen or route is this, and where does the person come from and go to?
- What does the person see while the data loads, when there is none, and when the request fails?
- Which endpoint does it call, and what does its response look like? If it belongs to another repository, name the issue that builds it with `Depends-on:`.
- Who may see or do this (a role, a permission, a logged-in state)?
- Is there a design reference (a picture, a component to reuse, a design token)? Name the file.
- Which texts must be translated, and into which languages?
- What must work on a narrow screen?
