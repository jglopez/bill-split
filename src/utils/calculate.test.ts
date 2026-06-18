// Standalone test script for getAmountEquivalent.
// Run with: npm test

import { getAmountEquivalent } from './calculate'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`${label}\n    expected: ${b}\n    actual:   ${a}`)
}

// ─── getAmountEquivalent ───────────────────────────────────────────────────

console.log('\ngetAmountEquivalent')

test('percent -> dollar, exact', () => {
  assertEqual(getAmountEquivalent('20%', 200), '$40.00', 'no tilde when exact to 2 decimals')
})

test('dollar -> percent, exact', () => {
  assertEqual(getAmountEquivalent('40', 200), '20%', 'no tilde when exact to 2 decimals')
})

test('dollar -> percent, rounded (1/3), 3 sig figs at 2 digits -> 1 decimal', () => {
  assertEqual(getAmountEquivalent('1', 3), '~33.3%', '3 sig figs caps 33.333...% at one decimal')
})

test('dollar -> percent, 3 sig figs at 1 digit -> 2 decimals', () => {
  assertEqual(getAmountEquivalent('1', 30), '~3.33%', '3.333...% shown with 2 decimals for 3 sig figs')
})

test('dollar -> percent, 3 sig figs below 1% -> 3 decimals', () => {
  assertEqual(getAmountEquivalent('1', 300), '~0.333%', '0.333...% shown with 3 decimals for 3 sig figs')
})

test('dollar -> percent, very small % caps at 3 decimals (fewer than 3 sig figs)', () => {
  assertEqual(getAmountEquivalent('1', 3000), '~0.033%', 'capped at 3 decimals rather than growing further')
})

test('dollar -> percent, 3 sig figs at 3+ digits -> 0 decimals', () => {
  assertEqual(getAmountEquivalent('150.5', 100), '~151%', 'values >= 100 round to a whole percent')
})

test('percent -> dollar, rounded', () => {
  assertEqual(getAmountEquivalent('33.333%', 3), '~$1.00', 'tilde when rounding loses precision')
})

test('zero base, percent input -> dollar is always computable', () => {
  assertEqual(getAmountEquivalent('20%', 0), '$0.00', '20% of $0 is $0, not hidden')
})

test('zero base, dollar input -> percent is undefined, hidden', () => {
  assertEqual(getAmountEquivalent('10', 0), null, 'cannot express $ as % of a zero base')
})

test('negative base, dollar input -> hidden', () => {
  assertEqual(getAmountEquivalent('10', -5), null, 'cannot express $ as % of a negative base')
})

test('empty input -> hidden', () => {
  assertEqual(getAmountEquivalent('', 100), null, 'empty input has no equivalent')
})

test('invalid percent input -> hidden', () => {
  assertEqual(getAmountEquivalent('abc%', 100), null, 'unparseable percent is hidden')
})

test('invalid dollar input -> hidden', () => {
  assertEqual(getAmountEquivalent('abc', 100), null, 'unparseable dollar amount is hidden')
})

test('trims whitespace', () => {
  assertEqual(getAmountEquivalent('  20%  ', 100), '$20.00', 'whitespace is trimmed before parsing')
})

test('trailing-zero percent equivalents are trimmed', () => {
  assertEqual(getAmountEquivalent('20.10', 100), '20.1%', 'trailing zero dropped, kept significant digit')
})

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
