## Why

In a sample of ten issues from one real web project, the issues that carried a design reference were built and approved with no iteration on how they looked. One issue that did not carry one needed eight iterations after QA had passed, about three hours of a person's time against a build of twenty minutes: how a loading state is noticed, how an error with data on screen is shown, and a first fix that broke the colour contrast and cost two more rounds. The cause was not the code. The specification said "a discreet loading indication", and nobody had decided what that looked like before the build.

`think` and `issue` decide behaviour well and appearance badly: they ask where a screen is and what it does, and rarely what it must look like in each state, at a narrow width, with long content or with the keyboard. Nothing in Relevo gives the person a way to see options before choosing, and nothing tells the developer or QA the same checkable rules.

This is one sample, so the change is built to be useful in any project and stack, and to be measured against a set of seeded defects.

## What Changes

- **A body of interface knowledge**, written once and read in four ways: a question for `think` and `issue` to ask, a check for the issue text, a "build it like this" rule for the developer agent, and a "check this" rule for QA. It starts from 84 rules adapted, in Relevo's own words, from an MIT-licensed collection of UX guidelines, each with a principle (not a CSS recipe), the platforms it applies to, whether it can block or only advise, how it is checked (in the code, in a rendered page or only by a person) and, where useful, a good and a bad example tagged by stack. Attribution goes in `NOTICE`, and the rules that cite WCAG 2.2 are verified against it before they ship.
- **Per-stack translation.** The plugin's profiles say how a rule reads in their stack (an accessible name is `aria-label` on the web and `Semantics` in Flutter), and only the examples of the stack of the issue are given to an agent. A stack with no interface says so, and a repository's own stack declares whether it has one.
- **The developer agent and QA receive only the rules that the change touches**, within a size limit, so the cost of every turn does not grow with the size of the collection. Until the specialist lenses exist, QA applies the blocking-eligible rules as part of its single review.
- **A step for the interface in `think`**, when the idea has something visible. It reads the project's design system (declared in `relevo.yml`, or detected and reported, or asked for when absent), settles the open appearance questions as numbered decisions, and shows two or three options as text wireframes with their states. It then renders the chosen finalists as static HTML, in a folder outside the repository and only after a yes, runs an automatic check on them before the person sees them, and lets the person open and choose. For a web stack the check covers contrast and horizontal overflow at 360 px. For a mobile stack such as Flutter the HTML is an approximate sketch in a phone frame, labelled as such, and the check uses mobile thresholds: contrast, overflow at 320 and 360 px, touch targets of 48 dp or 44 pt, and the layout at larger text sizes.
- **The tokens of the design system are read from the code by a script.** Colours, text styles, spacing and radii are extracted from the files the project declares as its tokens (or the ones detected and confirmed), with the file and line of each value, and the preview uses them, light and dark theme included. The script says what it could not resolve, and a derived palette (for example a colour scheme generated from a seed) is not computed: the person is asked for the main colours instead.
- **`/relevo:issue` carries the chosen option.** The chosen HTML goes into the `Design reference` section as example code that says what must match (structure, tokens and states, not the sample text), so `go` and QA already compare against it. The check warns about vague appearance words ("discreet", "noticeable", "nice") with no criterion or reference, and `issue` turns each warning into a question before the person approves.
- **Limits that fit a preview.** Example code in a `Design reference` no longer counts towards the warning on the length of the issue, and has its own limit.
- **Optional external design skills are documented, not installed.** The guide lists the ones evaluated, the role each suits and the cost of loading them, and says that none is recommended by default.
- **A set of seeded defects for the interface**, taken from the bad examples of the rules, used to compare a review with and without a rule and to test the preview check.

Out of scope: the specialist QA lenses and the model and effort of each role (change `specialist-review-lenses`), the preflight of inputs (change `build-preflight-gates`), a faithful rendering of a Flutter screen (widget previews or golden captures need code and the toolchain, which `think` does not use), generating images, comparing pixels, computing a derived colour palette, and a rule collection that a repository can weaken.

## Capabilities

### New Capabilities

- `interface-knowledge`: the rule collection and its fields, how rules are selected for a role, a stack and a change, the per-stack translation and examples, the limit on what an agent receives, what a repository may add, and the attribution.
- `design-tokens`: reading the colours, text styles, spacing and radii of a project's design system from its code, with the source of each value, the light and dark themes, what is reported as unresolved, and the extractors for the stacks the plugin ships.

### Modified Capabilities

- `think`: an interface step when the idea has a visible part; reading the design tokens; preview files outside the repository after a yes, as an HTML page for the web and as a labelled sketch for a mobile stack; running the preview check; recording the choice as a numbered decision.
- `issue`: asks the interface questions that the idea does not answer; writes the chosen example code in `Design reference`; warns on vague appearance words and asks about them; the length warning and limit for example code.
- `go`: selects the interface rules for the change after the specification and gives them to the developer agent and to QA.
- `platforms`: a profile says whether its stack has an interface (`web`, `mobile` or `none`) and may translate rules; a repository's own stack declares the same.
- `configuration`: optional keys that declare the design system (tokens, components, references) and their validation.
- `agent-adapters`: the knowledge folder is copied into the plugin rendered for Antigravity.
- `plugin-distribution`: the knowledge folder ships in the package.
- `init-doctor`: `doctor` notes that the preview check will be skipped when a web platform has no browser automation installed.
- `documentation`: the guide, the stacks page, the issue format and the configuration page describe the interface step, the rules, the keys and the optional external skills, in English and Spanish.

## Impact

- New `knowledge/interface/` in the plugin (the rules, the per-stack translations), a script that selects rules for a role, a stack and a change, a script that checks a rendered preview, and a script that extracts design tokens with an extractor for the web (custom properties and the configuration of the styling tool) and one for Dart. Tests for all three, with sample theme files (explicit colours, a class of constants, palette shades, opacity, a seed-derived scheme that must be reported as unresolved), and for the data (unique ids, every blocking rule has a check and an example for at least one stack).
- `skills/think/SKILL.md` and a new reference file for the interface step, `skills/issue/SKILL.md`, `skills/go/SKILL.md`, `agents/dev.md`, `agents/qa.md`.
- `scripts/check-issue.mjs`, `scripts/lib/issue-parse.mjs` and `scripts/lib/issue-check.mjs` (vague words, example-code limits), `scripts/stack-profile.mjs`, `scripts/lib/config.mjs`, `scripts/lib/adapters/antigravity.mjs`, `scripts/doctor.mjs`.
- The profiles in `stacks/`, the issue questions of each stack, and the design-system keys of `relevo.yml` and `templates/relevo.yml`.
- `NOTICE` (a third licensed work, with its copyright notice and the licence text), `package.json` files list, `docs/` pages and their Spanish pages.
- `tests/fixtures/` for the seeded defects and the preview check, and `tests/docs-claims.test.mjs`.
- No change to labels, to the lifecycle or to who may approve or merge.
