# Spec Delta

## MODIFIED Requirements

### Requirement: The audit of an iOS review separates faults and the app's errors from system noise
For an iOS review the audit SHALL read only the log of the app under review since the review started, as `simctl spawn <udid> log show --style ndjson --start <time> --predicate 'process == "<app>"'`, and SHALL ignore a line that is not a log entry. Every entry of type `Fault` SHALL be a finding, including the runtime issues that SwiftUI reports. An entry of type `Error` SHALL be counted and reported as system noise when its subsystem begins with `com.apple.`, or when its subsystem is empty and a system image wrote it, and SHALL be a finding otherwise. A system image is one whose `senderImagePath` is under `/System/Library/` or `/usr/lib/`, either from the start of the path or directly after `.simruntime/Contents/Resources/RuntimeRoot`; a path in the container of an app SHALL NOT be one. Entries of other types SHALL NOT be findings. Identical findings SHALL be reported once with a count. A log with no entry from the app SHALL be inconclusive, as for the other adapters. A crash report of the app captured after the review started (a `.ips` file under `~/Library/Logs/DiagnosticReports/` named after the executable, whose `captureTime` is after the start time and whose path holds the UDID of the simulator) SHALL be a finding of class `crash`, even when the log is empty, because the log of an app that crashed does not show the crash.

#### Scenario: A SwiftUI runtime issue
- **WHEN** the log holds a `Fault` from the subsystem `com.apple.runtime-issues`
- **THEN** it is a finding

#### Scenario: An error of the app or of a library
- **WHEN** the log holds an `Error` whose subsystem is the bundle identifier of the app or belongs to a library that is not Apple's
- **THEN** it is a finding

#### Scenario: An own subsystem written by a system image
- **WHEN** the log holds an `Error` whose subsystem does not begin with `com.apple.` and is not empty, written by a system image
- **THEN** it is a finding

#### Scenario: No subsystem, from the system libraries
- **WHEN** the log holds an `Error` with no subsystem whose `senderImagePath` begins with `/System/Library/` or `/usr/lib/`
- **THEN** it is not a finding and it is added to the number of ignored errors

#### Scenario: No subsystem, from the simulator runtime
- **WHEN** the log holds an `Error` with no subsystem whose `senderImagePath` has `/System/Library/` or `/usr/lib/` directly after `.simruntime/Contents/Resources/RuntimeRoot`
- **THEN** it is not a finding and it is added to the number of ignored errors

#### Scenario: No subsystem, from another folder of the runtime
- **WHEN** the log holds an `Error` with no subsystem whose image is under `RuntimeRoot` but outside `System/Library/` and `usr/lib/`
- **THEN** it is a finding

#### Scenario: No subsystem, from the app
- **WHEN** the log holds an `Error` with no subsystem written by an image inside the container of the app, whose path holds `/Library/` in the middle
- **THEN** it is a finding

#### Scenario: No subsystem and no image
- **WHEN** the log holds an `Error` with no subsystem and no `senderImagePath`
- **THEN** it is a finding

#### Scenario: A fault of a system image
- **WHEN** the log holds a `Fault` written by an image under `/System/Library/`
- **THEN** it is a finding

#### Scenario: Only ignored errors
- **WHEN** the only errors of the log are system noise and there is no `Fault` and no crash report
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: The same finding twice
- **WHEN** the same `Fault` appears three times
- **THEN** the audit reports it once with a count of 3

#### Scenario: Noise of an Apple framework
- **WHEN** the log holds an `Error` from `com.apple.app_launch_measurement`
- **THEN** it is not a finding, and the audit reports how many system errors it ignored

#### Scenario: Entries from before the review
- **WHEN** an `Error` of the app was written before the start time
- **THEN** it is not read

#### Scenario: A crash of the app
- **WHEN** the app crashed after the review started and its crash report is in the folder of reports
- **THEN** the audit is `REVIEW REJECTED` with a `crash` finding, even if the log of the app is empty

#### Scenario: A crash from before the review or of another app
- **WHEN** a crash report was captured before the start time, or belongs to another executable or another simulator
- **THEN** it is not read as a finding

#### Scenario: An empty log
- **WHEN** the filter matches no entry
- **THEN** the audit is inconclusive and says so

#### Scenario: Lines that are not entries
- **WHEN** the output has a line that is not JSON
- **THEN** the audit skips it and still reads the rest


## ADDED Requirements

### Requirement: An iOS error with no subsystem names the image that wrote it
A finding for an `Error` with no subsystem SHALL be shown as `[no subsystem, <file name of the image>] <message>`, without the path of the image, or as `[no subsystem] <message>` when the entry has no image. Such errors SHALL be grouped by image and message. Findings with a subsystem SHALL keep their text and grouping.

#### Scenario: An image of the app
- **WHEN** an `Error` with no subsystem was written by an image inside the container of the app
- **THEN** the finding shows the file name of the image and the message, and no folder of the path

#### Scenario: Two images, one message
- **WHEN** errors with no subsystem and the same message come from two different images that are not of the system
- **THEN** they are two findings, each with its own image and count

#### Scenario: An unknown writer
- **WHEN** an `Error` has no subsystem and no `senderImagePath`
- **THEN** the finding is shown as `[no subsystem] <message>`

### Requirement: The report of an iOS audit lists the errors ignored because of their image
The report SHALL list, apart from the findings, the errors ignored because a system image wrote them with no subsystem: file name of the image, message and number of times, for at most five different ones. The list SHALL NOT change the verdict, and the number of ignored errors SHALL count them all. Errors with a `com.apple.` subsystem SHALL only be counted. The list SHALL stay in the report after a finding is waived.

#### Scenario: Ignored errors are listed
- **WHEN** a system image wrote the same `Error` with no subsystem twice
- **THEN** the report lists the image and the message with 2 times, and the verdict does not change because of it

#### Scenario: More than five
- **WHEN** seven different errors were ignored because of their image
- **THEN** the report lists five and the number of ignored errors counts all of them

#### Scenario: Apple subsystems are not listed
- **WHEN** errors were ignored only because their subsystem begins with `com.apple.`
- **THEN** the report gives their number and lists none

#### Scenario: After a waiver
- **WHEN** a finding of the audit is waived and the report is written again
- **THEN** the report still lists the errors ignored because of their image
