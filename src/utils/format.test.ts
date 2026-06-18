// Standalone test script for format utilities.
// Run with: npm test

import { formatAmount, formatMoney } from './format'
import { test, assertEqual, summary } from '../test/harness'

// ─── formatAmount ─────────────────────────────────────────────────────────────

console.log('\nformatAmount')

test('positive number, no $ prefix', () => {
  assertEqual(formatAmount(5), '5.00', 'positive value')
})
test('zero', () => {
  assertEqual(formatAmount(0), '0.00', 'zero')
})
test('negative uses U+2212 minus (not ASCII hyphen)', () => {
  assertEqual(formatAmount(-5), '−5.00', 'Unicode minus before digits')
})
test('negative: sign precedes digits, no $', () => {
  // U+2212 is the Unicode minus sign
  const result = formatAmount(-3.50)
  assertEqual(result, '−3.50', '−3.50')
})
test('rounding to 2 decimal places', () => {
  assertEqual(formatAmount(1.005), '1.00', 'rounds to 2 decimals')
})

// ─── formatMoney ──────────────────────────────────────────────────────────────

console.log('\nformatMoney')

test('positive number with $ prefix', () => {
  assertEqual(formatMoney(5), '$5.00', 'positive value')
})
test('zero', () => {
  assertEqual(formatMoney(0), '$0.00', 'zero')
})
test('negative: Unicode minus precedes $, not after', () => {
  // Should be −$5.00, not $-5.00
  assertEqual(formatMoney(-5), '−$5.00', 'sign before $')
})
test('negative large amount', () => {
  assertEqual(formatMoney(-100), '−$100.00', '−$100.00')
})
test('rounding to 2 decimal places', () => {
  assertEqual(formatMoney(1.005), '$1.00', 'rounds to 2 decimals')
})

// ─── Summary ──────────────────────────────────────────────────────────────────

summary()
