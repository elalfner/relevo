# Spec Delta

## MODIFIED Requirements

### Requirement: Review and limit settings
`relevo.yml` SHALL support `review.mode` (`none`, `peer`, `roles`), `review.merger` (`author`, `approver`), `review.ship_without_ci` (`true`, `false`), `limits.built_unreviewed_per_person`, `limits.concurrent_agents`, `limits.review_sla_hours`, `limits.run_max_turns` and `limits.run_max_cost`.

#### Scenario: Review mode set
- **WHEN** `review.mode` is `peer` and `review.merger` is `approver`
- **THEN** validation passes and `ship` applies the peer rules

#### Scenario: Unattended ships without CI
- **WHEN** `review.ship_without_ci` is absent
- **THEN** it is `false`, and an unattended ship stops when there are no checks

#### Scenario: Invalid ship setting
- **WHEN** `review.ship_without_ci` is `yes`
- **THEN** validation fails and names the setting and the allowed values `true` and `false`
