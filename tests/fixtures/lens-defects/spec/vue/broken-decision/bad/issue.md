## Summary
Show the order total.

## Scenarios
- **WHEN** an order costs 10.5
- **THEN** the total reads 10.50

## Edge cases
- an empty order: the total reads 0.00

## Decisions
### D1. Two decimals
The total is always shown with two decimals, because the customers compare it with their receipt.
