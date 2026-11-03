## MODIFIED Requirements

### Requirement: The agent proves a line of an api review with an existing test
With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line of an `api` review only by running the test that already covers its scenario (a feature test selected by a filter, or, for Supabase, a pgTAP file passed to `supabase test db`), never by writing or editing a test, and SHALL record the filter or file it used, the number of tests or assertions that ran and the exit code. A run that matched no test or no file, or whose pgTAP plan ran no assertion, SHALL be a failed proof. For Supabase the agent SHALL also record the names of the assertions of the file that cover the `THEN` of the line, and the proof SHALL fail unless the run has at least one covered name, every covered name appears in the pgTAP file and none of them is among the failing assertions of the run; the pull request SHALL list the covered names for each line proved. With `verify` a line SHALL be marked `ok (auto)` only when the exit code proves its `THEN`; a line with no covering test, or one whose test does not assert its `THEN`, SHALL stay for the person.

#### Scenario: A test covers the line
- **WHEN** `review.autopilot` is `verify` and the test for line 2 ran once and exited 0
- **THEN** line 2 is `ok (auto)` and the pull request lists it with the test name

#### Scenario: A pgTAP file covers the line
- **WHEN** `review.autopilot` is `verify`, the platform is Supabase and `supabase test db supabase/tests/orders_rls.test.sql` ran 4 assertions, exited 0 and the run names the assertion `anon cannot insert orders` of that file as covering the line
- **THEN** the line that file covers is `ok (auto)` and the pull request lists it with the file, the count and the covered name

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the test for line 2 exited 0
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: A filter that matches nothing
- **WHEN** the filter matched no test, the file does not exist, or the pgTAP file ran no assertion
- **THEN** the proof fails, the line stays pending and the agent says no test was found

#### Scenario: No test for the line
- **WHEN** no test of the project covers a line
- **THEN** the agent does not write one, and the line is left to the person with a note that it has no test

#### Scenario: A pgTAP run that names no covering assertion
- **WHEN** the platform is Supabase and the run for the line exited 0 with assertions but names none as covering it
- **THEN** `precheck` and `auto` refuse the line and say that a covering assertion must be named

#### Scenario: A covered name that is not in the file
- **WHEN** the run names `anon cannot read invoices` as covering the line and the pgTAP file has no assertion with that name
- **THEN** the proof fails and the line stays for the person

#### Scenario: A covered assertion that failed
- **WHEN** the run names an assertion as covering the line and that assertion is among the failing ones
- **THEN** the proof fails, whatever the exit code of the other assertions
