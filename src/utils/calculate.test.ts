// Standalone test script for calculate utilities.
// Run with: npm test

import {
  getAmountEquivalent,
  parseAmount,
  parsePaidAmount,
  isValidAmount,
  isValidPrice,
  getTotalFeeBase,
  splitAmountInput,
  reconcileCents,
  calculateBreakdown,
  calculateSettlement,
} from './calculate'
import type { BillState, Item, Participant, AdditionalFee } from '../types'
import { test, assertEqual, summary } from '../test/harness'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function p(id: string): Participant { return { id, name: id } }

function item(id: string, price: string, assignedTo: string[] | null = null, taxable?: boolean): Item {
  const base: Item = { id, name: id, price, assignedTo }
  if (taxable === false) base.taxable = false
  return base
}

function fee(id: string, amount: string, base: 'pre-tax' | 'post-tax' = 'pre-tax'): AdditionalFee {
  return { id, name: id, amount, base }
}

function state(overrides: Partial<BillState> = {}): BillState {
  return {
    participants: [],
    items: [],
    tax: '',
    tip: '',
    tipBase: 'pre-tax',
    additionalFees: [],
    payerMode: 'single',
    singlePayerId: '',
    amountPaid: {},
    ...overrides,
  }
}

/** Sum per-person values to cents, for reconciliation assertions. */
function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + Math.round(b * 100), 0)
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

test('dollar -> percent, exact 100% keeps all digits', () => {
  assertEqual(getAmountEquivalent('100', 100), '100%', '$100 of $100 base should show 100%, not 1%')
})

test('dollar -> percent, exact 200% keeps all digits', () => {
  assertEqual(getAmountEquivalent('200', 100), '200%', '$200 of $100 base should show 200%, not 2%')
})

test('dollar -> percent, $0 shows 0% not bare %', () => {
  assertEqual(getAmountEquivalent('0', 100), '0%', '$0 should show 0%, not a bare %')
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

test('bare "%" (mid-toggle, no digits yet) -> hidden', () => {
  assertEqual(getAmountEquivalent('%', 100), null, 'no digits to convert yet')
})

test('negative percent -> dollar shows sign before $, not after', () => {
  assertEqual(getAmountEquivalent('-5%', 100), '-$5.00', 'discount equivalents read as -$5.00, not $-5.00')
})

test('non-finite percent input -> hidden', () => {
  assertEqual(getAmountEquivalent('Infinity%', 100), null, 'non-finite percent has no sensible dollar equivalent')
})

test('non-finite dollar input -> hidden', () => {
  assertEqual(getAmountEquivalent('Infinity', 100), null, 'non-finite dollar amount has no sensible percent equivalent')
})

test('non-finite base -> hidden', () => {
  assertEqual(getAmountEquivalent('20%', Infinity), null, 'a non-finite base has no sensible equivalent either direction')
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

// ─── parseAmount ──────────────────────────────────────────────────────────────

console.log('\nparseAmount')

test('empty string → 0', () => {
  assertEqual(parseAmount('', 100), 0, 'empty is 0')
})
test('whitespace-only → 0', () => {
  assertEqual(parseAmount('   ', 100), 0, 'whitespace-only is 0')
})
test('plain number', () => {
  assertEqual(parseAmount('10.50', 100), 10.5, 'flat dollar amount')
})
test('percentage of base', () => {
  assertEqual(parseAmount('20%', 100), 20, '20% of $100 = $20')
})
test('percentage of zero base', () => {
  assertEqual(parseAmount('20%', 0), 0, '20% of $0 = $0')
})
test('negative flat amount', () => {
  assertEqual(parseAmount('-5', 100), -5, 'negative flat = discount')
})
test('negative percentage', () => {
  assertEqual(parseAmount('-10%', 100), -10, '-10% of $100 = -$10')
})
test('invalid string → 0', () => {
  assertEqual(parseAmount('abc', 100), 0, 'non-numeric is 0')
})
test('invalid percent → 0', () => {
  assertEqual(parseAmount('abc%', 100), 0, 'non-numeric % is 0')
})
test('bare "%" → 0', () => {
  assertEqual(parseAmount('%', 100), 0, 'bare % is 0')
})

// ─── reconcileCents ───────────────────────────────────────────────────────────

console.log('\nreconcileCents')

test('even split needs no adjustment', () => {
  const result = reconcileCents([5, 5], 10)
  assertEqual(result, [5, 5], 'exact halves unchanged')
})
test('three-way split: sum of rounded shares equals total in cents', () => {
  const result = reconcileCents([10 / 3, 10 / 3, 10 / 3], 10)
  assertEqual(sumCents(result), 1000, 'cents sum to 1000')
  assertEqual(result.length, 3, 'three shares')
})
test('three-way split: each share is either 3.33 or 3.34', () => {
  const result = reconcileCents([10 / 3, 10 / 3, 10 / 3], 10)
  for (const v of result) {
    const cents = Math.round(v * 100)
    if (cents !== 333 && cents !== 334) throw new Error(`unexpected share ${v}`)
  }
})
test('empty array → empty array', () => {
  assertEqual(reconcileCents([], 0), [], 'no participants')
})
test('single participant: floating-point residue rounded to total', () => {
  // 10 / 3 * 3 = 10.000000000000002 in IEEE 754; reconcile to clean $10.00
  const rawTotal = 10 / 3 * 3
  const result = reconcileCents([rawTotal], rawTotal)
  assertEqual(Math.round(result[0] * 100), 1000, 'sole participant gets $10.00')
})
test('four-way even split unchanged', () => {
  const result = reconcileCents([2.5, 2.5, 2.5, 2.5], 10)
  assertEqual(result, [2.5, 2.5, 2.5, 2.5], 'quarters unchanged')
})

// ─── calculateBreakdown ───────────────────────────────────────────────────────

console.log('\ncalculateBreakdown')

test('two people, one item, no tax/tip', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalSubtotal, 10, 'totalSubtotal')
  assertEqual(bd.totalGrandTotal, 10, 'totalGrandTotal')
  assertEqual(bd.perPerson.length, 2, 'two entries')
  assertEqual(bd.perPerson[0].subtotal, 5, 'A subtotal')
  assertEqual(bd.perPerson[1].subtotal, 5, 'B subtotal')
})

test('three-way split: per-person subtotals sum to total in cents', () => {
  const s = state({
    participants: [p('A'), p('B'), p('C')],
    items: [item('x', '10')],
  })
  const bd = calculateBreakdown(s)
  assertEqual(sumCents(bd.perPerson.map(pp => pp.subtotal)), 1000, 'cents sum to 1000')
  assertEqual(bd.totalSubtotal.toFixed(2), (10.000000000000002).toFixed(2), 'totalSubtotal ≈ 10')
})

test('item assigned to explicit subset', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10', ['A'])],
  })
  const bd = calculateBreakdown(s)
  const a = bd.perPerson.find(pp => pp.participantId === 'A')!
  const b = bd.perPerson.find(pp => pp.participantId === 'B')!
  assertEqual(a.subtotal, 10, 'A gets full item')
  assertEqual(b.subtotal, 0, 'B gets nothing')
})

test('item assigned to nobody (assignedTo=[]) is skipped', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10', [])],
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalSubtotal, 0, 'unassigned item contributes nothing')
})

test('item with invalid price is skipped', () => {
  const s = state({
    participants: [p('A')],
    items: [item('x', 'abc')],
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalSubtotal, 0, 'invalid price → 0 subtotal')
})

test('tax applies to taxable items only', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [
      item('taxable', '10'),
      item('nontaxable', '6', null, false),
    ],
    tax: '10%',
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalSubtotal, 16, 'subtotal includes both items')
  assertEqual(bd.totalTaxableSubtotal, 10, 'only taxable item in tax base')
  assertEqual(bd.totalTax, 1, '10% of $10 taxable = $1 tax')
  assertEqual(bd.totalGrandTotal, 17, '$16 subtotal + $1 tax')
})

test('all items non-taxable → tax is $0 even with a tax value set', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10', null, false)],
    tax: '10%',
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalTax, 0, 'tax is 0 when nothing is taxable')
  assertEqual(bd.perPerson[0].tax, 0, 'per-person tax is 0')
})

test('flat tax splits proportionally by taxable subtotal', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [
      item('a1', '6', ['A']),
      item('b1', '4', ['B']),
    ],
    tax: '1',
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalTax, 1, '$1 flat tax')
  const a = bd.perPerson.find(pp => pp.participantId === 'A')!
  const b = bd.perPerson.find(pp => pp.participantId === 'B')!
  assertEqual(a.tax, 0.6, 'A pays 60% of tax (6/10)')
  assertEqual(b.tax, 0.4, 'B pays 40% of tax (4/10)')
})

test('tip pre-tax base', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
    tax: '10%',
    tip: '10%',
    tipBase: 'pre-tax',
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalTip, 1, '10% of $10 pre-tax subtotal = $1')
})

test('tip post-tax base', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
    tax: '10%',
    tip: '10%',
    tipBase: 'post-tax',
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalTip, 1.1, '10% of $11 post-tax amount = $1.10')
})

test('additional fee (surcharge)', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
    additionalFees: [fee('svc', '2')],
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalAdditionalFees[0], 2, '$2 surcharge')
  assertEqual(bd.perPerson[0].additionalFees[0], 1, 'A pays half')
  assertEqual(bd.perPerson[1].additionalFees[0], 1, 'B pays half')
})

test('additional fee as discount (negative amount)', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
    additionalFees: [fee('coupon', '-2')],
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalAdditionalFees[0], -2, '-$2 discount')
  assertEqual(bd.perPerson[0].additionalFees[0], -1, 'A saves $1')
})

test('no participants → empty perPerson', () => {
  const s = state({ items: [item('x', '10')] })
  const bd = calculateBreakdown(s)
  assertEqual(bd.perPerson.length, 0, 'no participants → no rows')
  assertEqual(bd.totalSubtotal, 0, 'nothing assigned')
})

test('grand totals: sum of per-person grands equals totalGrandTotal', () => {
  const s = state({
    participants: [p('A'), p('B'), p('C')],
    items: [item('x', '10'), item('y', '7')],
    tax: '8%',
    tip: '18%',
  })
  const bd = calculateBreakdown(s)
  const sumGrand = bd.perPerson.reduce((a, pp) => a + pp.grandTotal, 0)
  assertEqual(Math.round(sumGrand * 100), Math.round(bd.totalGrandTotal * 100), 'per-person totals sum to grand total')
})

// ─── calculateSettlement ──────────────────────────────────────────────────────

console.log('\ncalculateSettlement')

test('single payer: other participants owe their share', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'single',
    singlePayerId: 'A',
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  assertEqual(txns.length, 1, 'one transaction')
  assertEqual(txns[0].fromId, 'B', 'B pays')
  assertEqual(txns[0].toId, 'A', 'pays A')
  assertEqual(txns[0].amount, 5, 'B owes $5')
})

test('multiple payers: net difference settles correctly', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'multiple',
    amountPaid: { A: '8', B: '2' },
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  assertEqual(txns.length, 1, 'one transaction')
  assertEqual(txns[0].fromId, 'B', 'B pays')
  assertEqual(txns[0].toId, 'A', 'to A')
  assertEqual(txns[0].amount, 3, 'B owes A $3')
})

test('already settled: no transactions', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'multiple',
    amountPaid: { A: '5', B: '5' },
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  assertEqual(txns.length, 0, 'no transactions when all settled')
})

test('three-way: transaction amounts are whole cents', () => {
  const participants = [p('A'), p('B'), p('C')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'single',
    singlePayerId: 'A',
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  for (const t of txns) {
    assertEqual(Math.round(t.amount * 100) / 100, t.amount, `transaction ${t.fromId}→${t.toId} is whole cents`)
  }
})

test('three-way: settlement transactions sum to total owed by non-payers', () => {
  const participants = [p('A'), p('B'), p('C')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'single',
    singlePayerId: 'A',
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  const totalPaid = txns.filter(t => t.toId === 'A').reduce((a, t) => a + t.amount, 0)
  // A paid everything; B and C each owe their reconciled share
  const bShare = bd.perPerson.find(pp => pp.participantId === 'B')!.grandTotal
  const cShare = bd.perPerson.find(pp => pp.participantId === 'C')!.grandTotal
  assertEqual(Math.round(totalPaid * 100), Math.round((bShare + cShare) * 100), 'B+C payments to A cover their shares')
})

test('singlePayerId not in participants → no paid credit assigned', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'single',
    singlePayerId: 'nobody',
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  // No one is credited as having paid, so everyone owes their full share to "nobody"
  // — net for both A and B is positive (they owe) but there's no creditor.
  assertEqual(txns.length, 0, 'no creditor → no transactions')
})

test('settlement with overpayment: payer is owed the difference', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'multiple',
    amountPaid: { A: '12', B: '0' }, // A overpaid by $2
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  // A's grandTotal = 5, A paid 12, so net = 5-12 = -7 (owed $7)
  // B's grandTotal = 5, B paid 0, so net = 5-0 = +5 (owes $5)
  // Only B→A transaction because overpayment doesn't create a second creditor
  assertEqual(txns.length, 1, 'one transaction')
  assertEqual(txns[0].fromId, 'B', 'B pays')
  assertEqual(txns[0].toId, 'A', 'to A')
  assertEqual(txns[0].amount, 5, 'B pays their share')
})

test('settlement nets all within 0.005 threshold: no transactions', () => {
  const participants = [p('A'), p('B')]
  const s = state({
    participants,
    items: [item('x', '10')],
    payerMode: 'multiple',
    amountPaid: { A: '5.002', B: '4.998' }, // nets < 0.005, both within threshold
  })
  const bd = calculateBreakdown(s)
  const txns = calculateSettlement(s, bd)
  assertEqual(txns.length, 0, 'sub-cent nets produce no transactions')
})

// ─── calculateBreakdown (edge cases) ─────────────────────────────────────────

console.log('\ncalculateBreakdown (edge cases)')

test('additional fee on post-tax base', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10')],
    tax: '10%', // $1 tax, totalSubtotal = $10, post-tax = $11
    additionalFees: [fee('svc', '10%', 'post-tax')], // 10% of $11 = $1.10
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalTax, 1, '$1 tax')
  assertEqual(bd.totalAdditionalFees[0], 1.1, '10% of $11 post-tax = $1.10')
})

test('flat fee when pool base is 0 splits evenly', () => {
  // No items → subtotal = 0, fee base = 0, distributeProportionally falls back to even split
  const s = state({
    participants: [p('A'), p('B')],
    items: [],
    additionalFees: [fee('svc', '2')], // $2 flat fee with zero pool
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalAdditionalFees[0], 2, '$2 fee')
  assertEqual(bd.perPerson[0].additionalFees[0], 1, 'A pays half (even split)')
  assertEqual(bd.perPerson[1].additionalFees[0], 1, 'B pays half (even split)')
})

test('3-way negative discount splits proportionally', () => {
  const s = state({
    participants: [p('A'), p('B'), p('C')],
    items: [item('x', '30')], // $10 each
    additionalFees: [fee('coupon', '-3')], // -$3 total = -$1 each
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalAdditionalFees[0], -3, '-$3 discount')
  for (const pp of bd.perPerson) {
    assertEqual(pp.additionalFees[0], -1, 'each person saves $1')
  }
})

test('item assigned to id not in participants is silently skipped', () => {
  const s = state({
    participants: [p('A'), p('B')],
    items: [item('x', '10', ['ghost'])], // 'ghost' is not a participant
  })
  const bd = calculateBreakdown(s)
  assertEqual(bd.totalSubtotal, 0, 'item with non-participant assignee contributes nothing')
  assertEqual(bd.perPerson[0].subtotal, 0, 'A gets nothing')
  assertEqual(bd.perPerson[1].subtotal, 0, 'B gets nothing')
})

// ─── isValidAmount ────────────────────────────────────────────────────────────

console.log('\nisValidAmount')

test('empty string is valid (treated as 0)', () => {
  assertEqual(isValidAmount(''), true, 'empty allowed')
})
test('whitespace-only is valid', () => {
  assertEqual(isValidAmount('   '), true, 'whitespace allowed')
})
test('plain number is valid', () => {
  assertEqual(isValidAmount('12.50'), true, 'flat dollar')
})
test('negative number is valid (discount)', () => {
  assertEqual(isValidAmount('-5'), true, 'negative allowed')
})
test('percentage is valid', () => {
  assertEqual(isValidAmount('20%'), true, 'percent allowed')
})
test('negative percentage is valid', () => {
  assertEqual(isValidAmount('-10%'), true, 'negative percent allowed')
})
test('non-numeric string is invalid', () => {
  assertEqual(isValidAmount('abc'), false, 'text rejected')
})
test('non-numeric percent is invalid', () => {
  assertEqual(isValidAmount('abc%'), false, 'text% rejected')
})
test('Infinity is invalid', () => {
  assertEqual(isValidAmount('Infinity'), false, 'Infinity rejected')
})
test('Infinity% is invalid', () => {
  assertEqual(isValidAmount('Infinity%'), false, 'Infinity% rejected')
})

// ─── isValidPrice ─────────────────────────────────────────────────────────────

console.log('\nisValidPrice')

test('empty string is valid', () => {
  assertEqual(isValidPrice(''), true, 'empty allowed')
})
test('positive number is valid', () => {
  assertEqual(isValidPrice('9.99'), true, 'positive price')
})
test('zero is valid', () => {
  assertEqual(isValidPrice('0'), true, 'zero price')
})
test('negative number is invalid (prices are non-negative)', () => {
  assertEqual(isValidPrice('-5'), false, 'negative price rejected')
})
test('percentage string is invalid for prices', () => {
  assertEqual(isValidPrice('10%'), false, '% rejected for price')
})
test('non-numeric string is invalid', () => {
  assertEqual(isValidPrice('abc'), false, 'text rejected')
})
test('Infinity is invalid', () => {
  assertEqual(isValidPrice('Infinity'), false, 'Infinity rejected')
})

// ─── getTotalFeeBase ──────────────────────────────────────────────────────────

console.log('\ngetTotalFeeBase')

test('pre-tax base returns subtotal only', () => {
  assertEqual(getTotalFeeBase('pre-tax', 100, 10), 100, 'pre-tax ignores tax')
})
test('post-tax base returns subtotal + tax', () => {
  assertEqual(getTotalFeeBase('post-tax', 100, 10), 110, 'post-tax adds tax')
})
test('pre-tax with zero tax is just subtotal', () => {
  assertEqual(getTotalFeeBase('pre-tax', 50, 0), 50, 'pre-tax zero tax')
})
test('post-tax with zero tax is still subtotal', () => {
  assertEqual(getTotalFeeBase('post-tax', 50, 0), 50, 'post-tax zero tax = subtotal')
})

// ─── parsePaidAmount ──────────────────────────────────────────────────────────

console.log('\nparsePaidAmount')

test('valid number string', () => {
  assertEqual(parsePaidAmount('12.50'), 12.5, 'parses valid amount')
})
test('undefined returns 0', () => {
  assertEqual(parsePaidAmount(undefined), 0, 'undefined → 0')
})
test('empty string returns 0', () => {
  assertEqual(parsePaidAmount(''), 0, 'empty → 0')
})
test('non-numeric string returns 0', () => {
  assertEqual(parsePaidAmount('abc'), 0, 'non-numeric → 0')
})
test('Infinity string returns 0', () => {
  assertEqual(parsePaidAmount('Infinity'), 0, 'Infinity → 0')
})
test('-Infinity string returns 0', () => {
  assertEqual(parsePaidAmount('-Infinity'), 0, '-Infinity → 0')
})

// ─── splitAmountInput ─────────────────────────────────────────────────────────

console.log('\nsplitAmountInput')

test('plain number: not percent, numeric preserved', () => {
  assertEqual(splitAmountInput('10.50'), { isPercent: false, numeric: '10.50' }, 'flat dollar')
})
test('percent string: isPercent true, % stripped', () => {
  assertEqual(splitAmountInput('20%'), { isPercent: true, numeric: '20' }, 'percent')
})
test('bare %: isPercent true, numeric empty', () => {
  assertEqual(splitAmountInput('%'), { isPercent: true, numeric: '' }, 'bare %')
})
test('empty string: not percent, numeric empty', () => {
  assertEqual(splitAmountInput(''), { isPercent: false, numeric: '' }, 'empty')
})
test('whitespace trimmed', () => {
  assertEqual(splitAmountInput('  15%  '), { isPercent: true, numeric: '15' }, 'trims before parsing')
})
test('negative percent', () => {
  assertEqual(splitAmountInput('-10%'), { isPercent: true, numeric: '-10' }, 'negative percent')
})

// ─── Summary ──────────────────────────────────────────────────────────────────

summary()
