## Summary

<!-- What this does, who it is for and why, in two or three sentences. -->

## Scenarios

- **WHEN** <the situation>
- **THEN** <the result a person can observe>

## Edge cases

- <unusual input or state>: <what must happen>

## Out of scope

- <what is deliberately left out, with the issue that covers it when there is one>

<!-- Optional sections: delete what does not apply. -->

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

Depends-on: #<number>
