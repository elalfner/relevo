## ADDED Requirements

### Requirement: The profiles ask the issue writer how much data a list or table will hold
The section `Questions for the issue writer` of each profile the plugin ships (`flutter`, `vue`, `laravel` and `supabase`) SHALL include a question about volume and growth: how many items or rows the list, table or collection will hold, and whether the number grows. The question SHALL stay out of the body that `dev` and `qa` receive.

#### Scenario: Every shipped profile asks it
- **WHEN** the profile of `flutter`, `vue`, `laravel` or `supabase` is resolved with the role `issue`
- **THEN** its questions include one about how many items or rows there will be and whether that number grows

#### Scenario: The agents do not receive it
- **WHEN** the same profile is resolved for `dev` or `qa`
- **THEN** its body does not contain the question

#### Scenario: The answer becomes a limit
- **WHEN** the person answers that a list can hold tens of thousands of rows and the writer records it as a `Constraints` line
- **THEN** the line reaches `design.md` under `From the issue:` and binds the developer and QA like any other constraint

### Requirement: The Laravel profile asks for paginated collections
The body of the plugin's `laravel` profile SHALL tell the developer to paginate a collection that a caller can read and that can grow, and SHALL tell QA to look in the diff for an endpoint that returns every row of a table or relation with no limit. The rule SHALL be checkable by reading the diff.

#### Scenario: Rule for the developer
- **WHEN** the body of the `laravel` profile is read
- **THEN** it names pagination for a collection that can grow and says not to return a whole table to a caller

#### Scenario: Rule for the auditor
- **WHEN** the section of the body that lists what the auditor looks for is read
- **THEN** it names an endpoint that reads all the rows of a table or relation without a limit or a page

#### Scenario: A bounded collection
- **WHEN** a diff returns a collection that the issue declares as small and fixed
- **THEN** QA does not report it for lacking pagination

### Requirement: The Supabase profile asks for one query per set of related rows and for limits on growing tables
The body of the plugin's `supabase` profile SHALL tell the developer to read related rows in one query and not to call the client inside a loop, and to give a query on a table that can grow a limit or a range. It SHALL tell QA to look for both in the diff. Each rule SHALL be checkable by reading the diff.

#### Scenario: Client call in a loop
- **WHEN** the section of the body that lists what the auditor looks for is read
- **THEN** it names a call to the Supabase client inside a loop or a `map` over the rows of an earlier call

#### Scenario: Unbounded query
- **WHEN** the same section is read
- **THEN** it names a read of a table that can grow with no limit and no range

#### Scenario: Rule for the developer
- **WHEN** the section of hygiene for the developer is read
- **THEN** it tells the developer to read related rows in one query and to give a query on a growing table a limit or a range

#### Scenario: Questions for the writer keep their number
- **WHEN** the profile of `supabase` is resolved with the role `issue`
- **THEN** its questions still cover RLS, cascades, storage and the filtered columns, and have at least five items
