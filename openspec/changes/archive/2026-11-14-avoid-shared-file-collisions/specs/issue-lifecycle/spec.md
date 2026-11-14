## ADDED Requirements

### Requirement: A queued issue can wait for a file shared with another issue
`queued` SHALL have a third reason, a file that another issue names, besides the capacity of the assignee and a free agent slot. Entering it SHALL post one comment that names the file and the issue it waits for and mentions nobody. Later evaluations that leave it queued for that reason SHALL post nothing, and a change of the file or of the issue SHALL post one new comment.

#### Scenario: Entering the wait
- **WHEN** an eligible issue becomes `queued` because it names `router.ts` and issue 12 is active
- **THEN** one comment says so, with the file and `#12`, and nobody is mentioned

#### Scenario: Staying in the wait
- **WHEN** the next evaluation leaves it queued for the same file and the same issue
- **THEN** no comment is posted

#### Scenario: The reason changes
- **WHEN** issue 12 is merged and the issue then waits for the same file because issue 18 is active
- **THEN** one new comment names issue 18

#### Scenario: Language of the comment
- **WHEN** `language` in `relevo.yml` is Spanish
- **THEN** the comment is in Spanish, like every other message
