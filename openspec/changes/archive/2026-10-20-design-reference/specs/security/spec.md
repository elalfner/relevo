## ADDED Requirements

### Requirement: Downloads for a design reference are bounded
The download of a design reference SHALL happen in a script, not by the agent; the references SHALL come from the issue; the destinations SHALL be limited to the GitHub attachment domains and linked repositories; the token SHALL be sent only to GitHub; and the downloaded files SHALL stay out of git. Pasted attachments SHALL be downloaded only when `design.images` is on, because the model sees what they show.

#### Scenario: A screenshot with customer data
- **WHEN** `design.images` is off
- **THEN** no pasted attachment is downloaded or sent to the model

#### Scenario: Downloaded files and git
- **WHEN** an attachment was downloaded
- **THEN** the file is in a folder that git ignores and no commit can include it
