import { formatAmount } from './money.js';

export function cartTotalCents(lines) {
  return lines.reduce((sum, line) => sum + line.cents * line.qty, 0);
}

export function cartLabel(lines) {
  return `Total: ${formatAmount(cartTotalCents(lines))}`;
}
