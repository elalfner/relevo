# interface-preview Specification

## Purpose
Lets a person see and choose between interface options before anything is built, with preview files that never reach the repository and an automatic check whose result is never overstated.

## Requirements

### Requirement: Preview files are written outside the repository after a yes
`think` SHALL write a preview only after a direct yes to a question that names the folder, SHALL write it under the temporary folder of the machine and never inside the repository, and SHALL say that the files are not committed.

#### Scenario: The person agrees
- **WHEN** the person answers yes to the question that names the folder
- **THEN** the files are written there and `think` says that they are not committed

#### Scenario: The person does not agree
- **WHEN** the person answers no
- **THEN** no file is written and the options stay as text wireframes

#### Scenario: A path inside the repository
- **WHEN** the folder to write would be inside the repository
- **THEN** `think` does not write and chooses a folder outside it

### Requirement: A preview is self-contained
A preview SHALL be one file that makes no request to another address, has no script, shows each state stacked and labelled (loading with data and without, empty, error with data and without, a narrow width, long content), uses realistic content for the worst case, and starts with a comment that says it is a proposal and lists the tokens it uses.

#### Scenario: An external address
- **WHEN** a preview refers to an address outside the file
- **THEN** the check fails it

#### Scenario: A script
- **WHEN** a preview contains a script
- **THEN** the check fails it

### Requirement: The tokens of a preview carry the names of the project
A preview SHALL name its custom properties after the names in the code of the project and its header comment SHALL map each one to its file and line, so that the developer agent reuses the existing token.

#### Scenario: A mapped token
- **WHEN** a preview uses the colour of a constant named `AppColors.primary`
- **THEN** its property is named after that constant and the header maps it to the file and line of the constant

### Requirement: A mobile sketch is labelled and approximate
For a stack whose interface is `mobile`, a preview SHALL be a sketch in a phone frame, SHALL say on the page and in its header comment that it is an approximate sketch and not a render of the app, SHALL use only the standard widgets of the platform and the components that the design system already has, and SHALL mark as a risk, not draw, an effect the platform does not give cheaply.

#### Scenario: The label
- **WHEN** a sketch for a `mobile` stack is opened
- **THEN** the label is visible on the page and in the comment

#### Scenario: An effect that is costly
- **WHEN** the option needs a blurred background
- **THEN** the sketch marks it as a risk and does not draw it

### Requirement: A preview is checked before the person sees it
Before the person sees a preview, a script SHALL open it with a browser automation library, with scripts and network disabled, and report for each item `pass`, `fail`, `not checked` or `approximate`: horizontal overflow, text contrast against a solid background, and the size of interactive targets. A value that came from an approximation SHALL be `approximate`, and text over a gradient, an image or partial transparency SHALL be `not checked`.

#### Scenario: Overflow at a narrow width
- **WHEN** a page is wider than the viewport at 360 px
- **THEN** the item is `fail`

#### Scenario: Text over an image
- **WHEN** text sits over an image
- **THEN** its contrast is `not checked`

### Requirement: The thresholds follow the kind of interface
For `web` the check SHALL use widths of 360 and 1024 px and the minimum target size of WCAG 2.2. For `mobile` it SHALL use widths of 320 and 360 px, targets of at least 48 dp (44 pt for an iOS target), and a second pass with the text at 130% and at 200% of its size. The contrast SHALL use the real values of the tokens, light and dark.

#### Scenario: A mobile target that is too small
- **WHEN** a button in a mobile sketch is 40 dp high
- **THEN** the item is `fail` and names the element

#### Scenario: Larger text
- **WHEN** a mobile sketch overflows with the text at 200%
- **THEN** the item is `fail` for that pass

### Requirement: A failure is fixed and rechecked, and a missing check is never hidden
When an item fails, `think` SHALL fix the file and check again, at most twice, and show the person what it fixed. When no browser automation exists the script SHALL say that no automatic check ran and exit with its own code, and `think` SHALL tell the person the same. A preview SHALL NOT be presented as checked when it was not.

#### Scenario: A failure fixed
- **WHEN** the first check fails an item and the fix passes it
- **THEN** `think` shows the preview and says what it changed

#### Scenario: Still failing after two rounds
- **WHEN** an item still fails after two fixes
- **THEN** `think` shows the preview with the failing item named

#### Scenario: No browser automation
- **WHEN** the machine has no browser automation library
- **THEN** the script exits with its own code and `think` says that the preview was not checked

### Requirement: The check changes nothing outside the preview
The check SHALL NOT write into the repository, SHALL NOT run code of the project and SHALL NOT use the network.

#### Scenario: A run of the check
- **WHEN** the check runs on a preview
- **THEN** no file of the repository changes and no request leaves the machine
