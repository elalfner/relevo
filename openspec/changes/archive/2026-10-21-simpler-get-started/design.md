# Design

## Context

`docs/get-started.md` is about 1700 words with eight numbered steps, each with "You should see" and "If not", and a closing table. Tests keep the English and Spanish pages in step (`readme-sync`) and check the commands, labels and quoted output it names (`docs-claims`); one `cli` test asks every install page, including this one, to show `npm install -g @elalfner/relevo` and `relevo install --scope project`. The page was written for 0.2.0 and edited three times since: for the package, for the toolchain and for the plugin-first order.

## Goals / Non-Goals

**Goals:**
- A newcomer can follow it without choosing between two ways of doing the same thing and without meeting an unexplained word.
- A Vue or Laravel newcomer is not surprised by a failed QA.
- The page is shorter where the content was rare, not where it was needed.

**Non-Goals:**
- Changing the steps, their order or the format.
- Code, or what the build installs (the dependencies stay the project's choice).
- A walk-through by a person; it is the next thing, outside this change.

## Decisions

- **Move, do not delete.** The rare cases of step 3 go to the table at the end, which already exists for problems; the shortcut with npm stays in Install and on the cover. Nothing true is lost.
- **Terms in the sentence where they first appear**, not in a glossary page: ruleset ("a GitHub rule on a branch, for example that a pull request is required"), OpenSpec root (the `openspec/` folder that holds the specifications), milestone (a GitHub group of issues, which Relevo needs to know which issues may be built), secret (a value that GitHub keeps hidden and gives to the workflows), QA (the second agent that tries to reject the work). A page that makes the person leave it to understand a word is harder than a page with a clause.
- **The dependencies note sits in step 6 and in the table**, where the failure shows. The wording points to the commented lines of `relevo-go.yml` and says which command goes with which stack. Flutter's `pub get` runs by itself.
- **Tests.** The `cli` test keeps asking the install page and the cover for the shortcut, and stops asking Get started. A new test counts the fenced blocks of `claude plugin install` in Get started (exactly one, in each language) and looks for the dependency commands for Vue and Laravel in step 6.
- **Changelog.** One line under the 0.3.1 release, because the tag is not pushed yet; if it is pushed by the time this ships, the line goes under Unreleased.

## Risks / Trade-offs

- Shortening step 3 hides detail; the table keeps it, and the Configuration page explains the settings in full.
- The page can still be hard in ways only a person sees. The walk-through after the change is how that is found; this change does not claim the page is easy, only that the known problems are gone.
- Moving text changes anchors; the link check test catches a broken one.
