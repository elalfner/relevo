## MODIFIED Requirements

### Requirement: Writes follow the invoked skills' rules
Any file written while `think` runs, such as OpenSpec artifacts that the person asks for, SHALL be written only as the invoked skill's own rules allow. `think` SHALL NOT write `GLOSSARY.md` or any file under `docs/adr/`, and SHALL NOT write a file itself except the agreement file the person asked for and, after a direct yes, the preview files of the interface step, which are written outside the repository.

#### Scenario: Skill needs permission to write
- **WHEN** an invoked skill requires confirmation before writing
- **THEN** nothing is written until the person gives it

#### Scenario: A preview after a yes
- **WHEN** the interface step has options to show and the person answers yes to the question that names a folder outside the repository
- **THEN** `think` writes the preview files there, and no file inside the repository changes

#### Scenario: A preview is not application code
- **WHEN** `think` writes a preview
- **THEN** it is a proposal for the person to look at, is never committed and is not application code

## ADDED Requirements

### Requirement: An idea with a visible part gets an interface step
When the idea has something the person will see, `think` SHALL run an interface step after the exploration and before the interview that the person launches, and SHALL ask the person to confirm that the idea has a visible part when it cannot tell. An idea with nothing visible SHALL skip the step.

#### Scenario: A screen
- **WHEN** the idea is a new screen
- **THEN** `think` runs the interface step after the exploration

#### Scenario: A background task
- **WHEN** the idea has nothing the person will see
- **THEN** `think` skips the step and says nothing about it

### Requirement: The design system is read, and what is detected is confirmed
The interface step SHALL read the design system with read-only commands, from the paths the project declares, or from the ones it detects and lists for the person to confirm, and SHALL ask the person when it finds nothing. It SHALL NOT assume the name of a folder.

#### Scenario: Declared paths
- **WHEN** the project declares the paths of its tokens and components
- **THEN** `think` reads those and no others

#### Scenario: Nothing found
- **WHEN** nothing is declared and nothing is detected
- **THEN** `think` asks the person where the design system lives, or whether there is none

### Requirement: Only the open appearance questions are asked
The interface step SHALL take its questions from the interface rules and the questions of the stack, and SHALL ask only what the idea and the conversation have not already answered, one at a time, as `think` already asks.

#### Scenario: A state already answered
- **WHEN** the person has already said what the screen shows while it loads
- **THEN** `think` does not ask it again

### Requirement: Options are shown as wireframes with their states
For each open appearance decision the interface step SHALL show two or three options as text wireframes with a table of the states they cover, reusing the components of the design system and inventing none. It SHALL show no more than three options for one decision.

#### Scenario: A loading state with data on screen
- **WHEN** the decision is how a reload shows while rows are already on screen
- **THEN** `think` shows the options, each with the states loading with data, loading without data, empty and error

#### Scenario: A component that does not exist
- **WHEN** an option would need a component that the design system lacks
- **THEN** `think` says so in the option instead of drawing it as if it existed

### Requirement: The choice is recorded as a decision
Each choice SHALL be recorded in the list that `think` keeps as a numbered decision with the reason and the options that were discarded, and the constraints it implies as numbered constraints, so that `issue` carries them into the issue.

#### Scenario: An option chosen
- **WHEN** the person chooses one option
- **THEN** the agreement has a decision with its reason and the discarded options

### Requirement: Previews are offered for the finalists
After the wireframes the interface step SHALL offer previews of the finalists, SHALL show the table of tokens first, and SHALL write and check them as the `interface-preview` capability says. It SHALL offer previews for a stack with a `web` or `mobile` interface and SHALL NOT offer them for a stack with none.

#### Scenario: A web stack
- **WHEN** the stack has a `web` interface and the person asks for previews of two finalists
- **THEN** `think` shows the tokens, writes two previews after a yes, checks them and shows them

#### Scenario: A stack with no interface
- **WHEN** the stack has no interface
- **THEN** `think` offers no preview

### Requirement: The interface step does not change the interview or the hand-off
The interface step SHALL NOT change the order of the exploration and the interview, the reserved interview that the person launches, the list of what the exploration settled, or the hand-off to `issue`. The decisions it records SHALL be in the list that the person takes to the interview.

#### Scenario: The interview is reserved for the person
- **WHEN** `think` asks the person to run the reserved interview
- **THEN** the same message holds the list, including the decisions of the interface step with their ids
