## MODIFIED Requirements

### Requirement: Downloads for a design reference are bounded
The download of a design reference or a linked code pointer SHALL happen in a script, not by the agent; the references SHALL come from the issue; the destinations SHALL be limited to the GitHub attachment domains and linked repositories; the token SHALL be sent only to GitHub; and the downloaded files SHALL stay out of git. Pasted attachments SHALL be downloaded only when `design.images` is on, because the model sees what they show.

#### Scenario: A screenshot with customer data
- **WHEN** `design.images` is off
- **THEN** no pasted attachment is downloaded or sent to the model

#### Scenario: Downloaded files and git
- **WHEN** an attachment was downloaded
- **THEN** the file is in a folder that git ignores and no commit can include it

## ADDED Requirements

### Requirement: The agent never holds the token for linked repositories
In the cloud, the secret `RELEVO_LINKS_TOKEN` SHALL be given only to the step that applies the gates, to the queue, and to the step that fetches the references before the agent. It SHALL NOT be in the environment of the agent step, or of any step that can push or that runs commands the agent wrote.

#### Scenario: Build job
- **WHEN** the go workflow runs a build
- **THEN** the only step of the build that maps `RELEVO_LINKS_TOKEN` is the fetch step, and the agent step does not map it
