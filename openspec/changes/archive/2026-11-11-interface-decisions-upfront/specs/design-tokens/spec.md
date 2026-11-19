## Purpose

Reads the colours, text styles, spacing and radii of a project's design system from its code, so that a preview and a review use the values the project really has, and says plainly what it could not determine.

## ADDED Requirements

### Requirement: The tokens are read from the code with the source of each value
A script SHALL read the files that the project declares as its tokens, or that were detected and confirmed, and print for each token its name, its value, its theme (light or dark) and the file and line it came from, in a form a program can read and in text. Given the same files it SHALL print the same result.

#### Scenario: A named colour
- **WHEN** a constant with a name holds a colour literal in a declared file
- **THEN** the output has that name, the value, the theme and the file and line of the definition

#### Scenario: The same input twice
- **WHEN** the script runs twice on unchanged files
- **THEN** the two outputs are identical

### Requirement: Only declared or confirmed files are read, and nothing is executed
The script SHALL read only the files inside the paths declared for the tokens, or detected and confirmed by the person, SHALL NOT run any code of the project, SHALL NOT use the network, and SHALL NOT read a restricted file.

#### Scenario: A colour in another file
- **WHEN** a colour literal appears in a file outside the declared paths
- **THEN** it is not read and is not in the output

#### Scenario: A restricted file
- **WHEN** a declared path holds a file on the restricted list
- **THEN** the script does not open it and says that it skipped it

### Requirement: The Dart extractor follows the common ways a theme is written
For Dart the script SHALL read colour literals, constants with a name followed to their definition, colour schemes built with explicit parameters, the shades of the standard palette from its fixed table, an opacity applied to a known colour, classes that extend the theme with colours of their own, text styles (size, weight and family), and constants for spacing and radii, and SHALL read a dark theme as a second set.

#### Scenario: A palette shade
- **WHEN** the theme uses a shade of the standard palette
- **THEN** the output holds its value from the fixed table

#### Scenario: An opacity on a known colour
- **WHEN** a colour is derived from a known colour by an opacity
- **THEN** the output holds the resulting value and says it was derived

#### Scenario: A dark theme
- **WHEN** the files define a light and a dark scheme
- **THEN** the output has both sets, each marked with its theme

### Requirement: The web extractor follows the common ways a theme is written
For the web the script SHALL read custom properties declared on the root and in a dark-mode block, and the colour and spacing scales of the configuration of the styling tool, SHALL resolve a custom property that refers to another, and SHALL report the theme of each.

#### Scenario: A property that refers to another
- **WHEN** a custom property is defined as another custom property
- **THEN** the output holds the final value and the name of both

#### Scenario: A dark-mode block
- **WHEN** a block redefines properties for dark mode
- **THEN** the output marks those values as dark

### Requirement: What cannot be determined is reported and never guessed
The script SHALL list as unresolved a colour scheme derived from a seed, a colour that comes from the device or from a server, a value behind a reference it could not follow, and any token it could not read. It SHALL NOT compute a derived palette and SHALL NOT fill an unresolved token with a guess.

#### Scenario: A scheme derived from a seed
- **WHEN** the theme builds its colour scheme from a seed colour
- **THEN** the scheme is in the unresolved list with its file and line, and no colour is invented for it

#### Scenario: A reference that cannot be followed
- **WHEN** a token refers to a value the script cannot reach
- **THEN** the token is unresolved and the output says why

### Requirement: More than one theme is listed and the person chooses
When the declared files define more than one theme, such as several brands or flavours, the script SHALL list them and SHALL NOT merge their values.

#### Scenario: Two brands
- **WHEN** the files define a theme for each of two brands
- **THEN** the output lists both separately and the caller asks which one to use

### Requirement: The person sees the tokens before a preview exists
`think` SHALL show the table of tokens and the unresolved list to the person before it writes any preview, and, when the table lacks the main colours, SHALL ask for the three or four that matter instead of inventing them.

#### Scenario: A table with gaps
- **WHEN** the primary colour is unresolved
- **THEN** `think` asks for it before writing the preview

#### Scenario: A complete table
- **WHEN** every token the preview needs is resolved
- **THEN** `think` shows the table once and goes on
