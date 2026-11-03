# The interface step of `think`

Read this when the idea has something the person will see. It runs after the exploration and before the interview that the person launches. It decides how the visible part looks and behaves, before an issue exists, so that the issue and the build start from a choice and not from a guess. It never writes application code.

## 1. When it runs and when it does not

- **It runs** when the idea is a screen, a page, a component, a form, a list, a dialog, an email or a document the person will look at, or when a change alters how something already visible behaves.
- **It is skipped, without a word about it,** for a background task, a data change with no screen, a script, an integration or a fix with nothing visible.
- **When you cannot tell**, ask once: "Does this have a part the person will see?" and follow the answer.
- A platform whose stack has no interface (`interface: none` in its profile) has no step: skip it. Find the stack with `node ${CLAUDE_PLUGIN_ROOT}/scripts/stack-profile.mjs --platform <name>` and read the `interface` kind of its profile; for a repository with several platforms, use the one the idea touches.

## 2. Read the design system, never assume it

Use read-only commands only.

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/design-tokens.mjs --json`. It reads only the paths that `relevo.yml` declares under `design.system` and prints the tokens with their file and line.
2. When nothing is declared it reads nothing and lists, by convention, the files it would suggest. Show that list to the person and ask which are the tokens and the components. Run the command again with `--paths <the confirmed ones>`.
3. When it finds nothing, ask where the colours, text styles and components of the project live, or whether there is no design system. Do not look for a folder by a name you assumed.
4. Read the components folder (`design.system.components`, or the one the person named) with `Read`, `Glob` and `Grep`, to know which components exist. An option may use a component that exists. An option that needs one that does not exist says so in the option; it does not draw it as if it existed.
5. **Show the table of tokens to the person before anything is drawn**, with the unresolved list. If the main colours are unresolved (a scheme derived from a seed, a colour from the device or a server), ask for the three or four that matter instead of inventing them. If the table is complete, show it once and go on. When there is more than one set (several brands or flavours), ask which one to use.

## 3. Ask only the open questions

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/interface-rules.mjs --role think --platform <name> --text "<the idea in a few lines>"`. It prints the core rules and those that match the words of the idea, each as a question. Add the questions of the stack from `stack-profile.mjs --role issue`.

Ask one question at a time, as `think` already asks, and **only what the idea and the conversation have not already answered**. If the person has already said what a screen shows while it loads, do not ask it again. Prefer questions about states, content that can be long or absent, who sees it and on what device, over questions about colour.

## 4. Show options as wireframes with their states

For each open appearance decision, show **two or three options, never more**, as text wireframes (monospace blocks) and, under each, a table of the states it covers:

| State | What the person sees |
|---|---|
| Loading, with data on screen | … |
| Loading, without data | … |
| Empty | … |
| Error, with data on screen | … |
| Error, without data | … |
| Narrow width / long content | … |

Reuse the components of the design system. Do not invent a component. Mark the differences between the options in a line each, and say which one you recommend and why.

## 5. Record the choice

Each choice goes into the list **Settled so far** that `think` keeps, with the next free id:

- a decision `D<n>`: what was chosen, **the reason**, and **the options that were discarded**;
- the constraints it implies as `C<n>` (for example "the table scrolls inside its own container below 640 px");
- an open question as `Q<n>`.

These items are in the same list that the person takes to the reserved interview and that `/relevo:issue` reads, so they reach the issue with their ids.

## 6. Previews of the finalists (stacks with an interface only)

After the wireframes, when two or three options are still in play **and the stack has a `web` or `mobile` interface**, offer to draw the finalists as HTML pages. Never offer them for a stack without an interface.

1. **Ask for a direct yes that names the folder**, outside the repository: "May I write the previews to `<temporary folder of the machine>/relevo-previews/`? Nothing is committed." Without a yes, write nothing and stay with the wireframes. If the folder would be inside the repository, choose another outside it.
2. Write one file per finalist there. It is the only file `think` writes besides the agreement file, it is a proposal and not application code, and it is never committed.
3. Each file is **self-contained**: one file, no request to another address, no script, the states stacked and labelled (loading with data and without, empty, error with data and without, a narrow width, long content), realistic content for the worst case, 16 KB or less. It **starts with a comment** that says it is a proposal, lists the tokens it uses, and, in a line `approximate: --a, --b`, the custom properties whose value came from an approximation.
4. **Name the custom properties after the project's tokens** (`--app-primary` for the constant `AppColors.primary`) and map each in the header comment to its file and line, so the developer agent reuses the existing token and does not write a new literal.
5. **For a `mobile` stack the file is a sketch**: a phone frame about 360 px wide, using only the standard widgets of the platform and the components the design system has. It says "approximate sketch, not a render of the app" **on the page and in the header comment**. An effect that the platform does not give cheaply (a blurred background, a complex gradient) is marked as a risk in the option, not drawn. Elevation, ripples, safe areas and platform style differences are not reproduced, and the label says so. The on-device review remains where appearance is decided.
6. **Check each file before the person sees it**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-check.mjs <file> --kind <web|mobile> --json`. Add `--ios` when the target is iOS. It reports each item as `pass`, `fail`, `not checked` or `approximate`.
   - On a `fail`, fix the file and check again, **at most twice**, and tell the person what you changed. If an item still fails after two fixes, show the preview with the failing item named.
   - `not checked` (text over an image, a gradient or a partly transparent colour) and `approximate` are said as they are; they are never presented as a pass.
   - **Exit code 3 means no browser automation exists** and nothing was checked. Tell the person plainly that the preview was **not checked**, and show the file checks that did run. Never present it as checked.
7. Tell the person the paths, that they open them in a browser, and ask which one they choose. The choice is recorded as in step 5, and the chosen option travels into the issue as example code through `/relevo:issue`.
