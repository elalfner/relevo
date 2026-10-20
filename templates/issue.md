## Summary

<!-- What this does, who it is for and why, in two or three sentences. -->

## Outcome

<!-- Optional. The observable result that shows the issue is done, in one or two sentences. -->

## Scenarios

- **WHEN** <the situation>
- **THEN** <the result a person can observe>

## Edge cases

- <unusual input or state>: <what must happen>

## Out of scope

- <what is deliberately left out, with the issue that covers it when there is one>

<!-- Optional sections: delete what does not apply. Headings stay in English; write the contents in the language of the repository. -->

## Decisions

<!-- Optional. One block per decision the agreement settled, with an id. Words that were rejected go under Discarded. -->

### D1. <decision title>
Decided: <what was decided>
Why: <the reason>
Discarded: <the alternative> (<why not>)

## Constraints

<!-- Optional. A concrete limit per line, with an id: security, performance, data, integration, business rule or accessibility. -->

- C1: <a concrete limit>

## Code pointers

<!-- Optional. What the exploration found in the code; the builder checks it before trusting it. -->

- `<path/to/file>`: <why it matters>

## Verification

<!-- Optional. What only a person can check on a device or in a browser. Test data by name, never secrets. -->

- <what only a person can check, and with which data>

## Assumptions

<!-- Optional. What the person approved without being sure. -->

- <an assumption>

## Open questions

<!-- Anything written here sends the issue back to its writer: answer it first, then delete the section. -->

## Screens and behaviour

<!-- Where it appears, what it looks like, when it shows or hides, animation and feedback, loading and error states, reference image. -->

## Data contract

<!-- For each endpoint or data source: method and path, how the caller authenticates, request fields, a realistic response with types, and which values may be null. -->

## Documentation

<!-- Optional. Only when the agreement settled terms or decisions to record; leave it out otherwise. Exact text, nothing but glossary entries and decision records. -->

- Add these entries to `GLOSSARY.md`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**<term>**:
<definition>
_Avoid_: <words to avoid>

<!-- Optional. Only when relevo.yml has several platforms: the one platform this issue is for. A feature that needs two platforms is two issues linked with Depends-on. -->

Platform: <name of a platform in relevo.yml>

<!-- Optional. Only when the change needs a new dependency: the manifest and lock files it may touch. Without this line an unattended run refuses to change them. -->

Allow-paths: <dependency files the change may touch, for example pubspec.yaml, pubspec.lock>

<!-- Optional. Related issues of the same idea; it only informs. -->

Related: #<number>

<!-- Optional. #<number> is an issue of this repository; owner/repo#<number> is an issue of a repository listed in links of relevo.yml. -->

Depends-on: #<number>
