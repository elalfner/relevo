// Formats an amount in cents for display, for example 1250 gives "12.50".
// Changed in 2.0: it returns a string for display; it used to return the amount in currency units as a number.
export function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}
