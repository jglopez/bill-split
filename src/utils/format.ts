// Negative amounts use Unicode minus (U+2212) so the sign precedes the currency
// symbol when present, and meaning isn't conveyed by color alone (WCAG).

function unsignedAmount(n: number): string {
  return Math.abs(n).toFixed(2)
}

/** Format a number as a plain decimal amount (no $ prefix). */
export function formatAmount(n: number): string {
  return (n < 0 ? '−' : '') + unsignedAmount(n)
}

/** Format a number as a dollar amount with $ prefix. */
export function formatMoney(n: number): string {
  return (n < 0 ? '−$' : '$') + unsignedAmount(n)
}
