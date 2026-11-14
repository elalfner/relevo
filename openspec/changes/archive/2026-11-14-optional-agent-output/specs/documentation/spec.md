## ADDED Requirements

### Requirement: The full output option is documented with its risk
The security, configuration and execution pages SHALL describe `run.full_output`, the `full_output` input of the manual start, what is printed and saved with the option on and off, that the rendering appears after the agent step and not while it runs, that the redactor can miss a secret it does not know, that the option is off by default and refused for `trust: public`, and how long the artifact is kept. The Spanish pages SHALL carry the same headings and commands. `action-parameters.md` SHALL say that the template never sets `show_full_output` and why.

#### Scenario: Pages agree
- **WHEN** the English and Spanish pages are compared
- **THEN** they name the same setting, input and limits
