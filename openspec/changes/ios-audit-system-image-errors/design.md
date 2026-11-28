# Design

## Context

`auditIosLog` (`scripts/lib/logaudit-ios.mjs`) decides noise from the subsystem alone, folds findings by type, subsystem and message, and returns `ignored` as a number. `iosReviewAudit` builds the excerpt `[subsystem] message`, which waivers match together with the class. `review-state.mjs audit` copies selected fields into `state.audit`, and `waive` rewrites the report from that copy, so anything the report needs must be stored there. See proposal.md for the motivation; the decisions D1 to D10 of issue #230 are settled.

## Goals / Non-Goals

**Goals:** the rule, the image in the finding and the list of ignored errors, with the functions staying pure.

**Non-Goals:** the other audits, and any setting to change which images are of the system.

## Decisions

- **Anchored match of a system image.** The path must match `/System/Library/` or `/usr/lib/` at its start, or directly after `.simruntime/Contents/Resources/RuntimeRoot`, and a path holding `/data/Containers/` is never one. The runtime itself lives under a folder with a variable prefix and spaces, so the second form cannot be anchored to a fixed start; the container exclusion keeps an app that ships a folder of that name from matching. Discarded: a substring search for `/System/Library/` or `/usr/lib/` (an app path could match).
- **Grouping by the full image path, showing the file name.** Only `Error` entries with an empty subsystem add the image to the grouping key; every other key stays as it is. Discarded: grouping by file name, which would merge two different images.
- **The list of ignored errors is data, not text.** The audit returns `ignoredByImage`, every entry `{ image, message, count }` folded by image path and message, in order of first appearance, with `image` already reduced to the file name. The report shows the first five. `ignored` stays the total of both rules.
- **Persisted in the review state.** `state.audit` keeps `ignoredByImage`, so the report written after a waiver still has it.
- **File name only in the list too.** A path in the runtime form carries folders of the machine, so the list shows what a finding shows.
- **Same excerpt limit.** The image goes inside the bracket and the excerpt is still cut at 200 characters.

## Risks / Trade-offs

- [An error caused by the app and written by a system library with no subsystem is ignored] → it is listed in the report with its image and message.
- [More than five such errors: the rest are not shown] → the total counts them, and `log show` still has them.
- [Two images with the same file name give two findings that read the same, and one waiver covers both] → accepted: it needs the same name and the same message.
- [A waiver recorded before this change for an error with no subsystem no longer matches] → the person waives it again.
- [Only the form without the runtime prefix has been seen in app processes (assumption A1 of the issue)] → both forms are tested with built entries.
