/**
 * Format a number as a plain decimal amount (no $ prefix).
 * Negative amounts use the Unicode minus sign so meaning isn't conveyed
 * by color alone (WCAG). Used in summary table cells and item share hints.
 */
export function formatAmount(n: number): string {
  return (n < 0 ? '−' : '') + Math.abs(n).toFixed(2)
}

/**
 * Format a number as a dollar amount with $ prefix.
 * Negative amounts use the Unicode minus sign so the sign precedes $ (−$5.00,
 * not $-5.00) and meaning isn't conveyed by color alone (WCAG).
 * Used in payer inputs, settlement rows, and similar monetary displays.
 */
export function formatMoney(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2)
}
