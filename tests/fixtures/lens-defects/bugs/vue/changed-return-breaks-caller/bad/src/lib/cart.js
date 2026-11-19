import { formatAmount } from './money.js';

export function cartTotal(lines) {
  return lines.reduce((sum, line) => sum + formatAmount(line.cents * line.qty), 0);
}

export function cartLabel(lines) {
  return `Total: ${formatAmount(lines.reduce((sum, line) => sum + line.cents * line.qty, 0))}`;
}
