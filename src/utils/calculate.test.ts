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
import { describe, it, expect } from 'vitest'

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
    tipDiscountBase: 'pre-discount',
    tipFeeBase: 'pre-fee',
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

describe('getAmountEquivalent', () => {
  it('percent -> dollar, exact', () => {
    expect(getAmountEquivalent('20%', 200)).toEqual('$40.00')
  })

  it('dollar -> percent, exact', () => {
    expect(getAmountEquivalent('40', 200)).toEqual('20%')
  })

  it('dollar -> percent, rounded (1/3), 3 sig figs at 2 digits -> 1 decimal', () => {
    expect(getAmountEquivalent('1', 3)).toEqual('~33.3%')
  })

  it('dollar -> percent, 3 sig figs at 1 digit -> 2 decimals', () => {
    expect(getAmountEquivalent('1', 30)).toEqual('~3.33%')
  })

  it('dollar -> percent, 3 sig figs below 1% -> 3 decimals', () => {
    expect(getAmountEquivalent('1', 300)).toEqual('~0.333%')
  })

  it('dollar -> percent, very small % caps at 3 decimals (fewer than 3 sig figs)', () => {
    expect(getAmountEquivalent('1', 3000)).toEqual('~0.033%')
  })

  it('dollar -> percent, 3 sig figs at 3+ digits -> 0 decimals', () => {
    expect(getAmountEquivalent('150.5', 100)).toEqual('~151%')
  })

  it('dollar -> percent, exact 100% keeps all digits', () => {
    expect(getAmountEquivalent('100', 100)).toEqual('100%')
  })

  it('dollar -> percent, exact 200% keeps all digits', () => {
    expect(getAmountEquivalent('200', 100)).toEqual('200%')
  })

  it('dollar -> percent, $0 shows 0% not bare %', () => {
    expect(getAmountEquivalent('0', 100)).toEqual('0%')
  })

  it('percent -> dollar, rounded', () => {
    expect(getAmountEquivalent('33.333%', 3)).toEqual('~$1.00')
  })

  it('zero base, percent input -> dollar is always computable', () => {
    expect(getAmountEquivalent('20%', 0)).toEqual('$0.00')
  })

  it('zero base, dollar input -> percent is undefined, hidden', () => {
    expect(getAmountEquivalent('10', 0)).toEqual(null)
  })

  it('negative base, dollar input -> hidden', () => {
    expect(getAmountEquivalent('10', -5)).toEqual(null)
  })

  it('empty input -> hidden', () => {
    expect(getAmountEquivalent('', 100)).toEqual(null)
  })

  it('bare "%" (mid-toggle, no digits yet) -> hidden', () => {
    expect(getAmountEquivalent('%', 100)).toEqual(null)
  })

  it('negative percent -> dollar shows sign before $, not after', () => {
    expect(getAmountEquivalent('-5%', 100)).toEqual('-$5.00')
  })

  it('non-finite percent input -> hidden', () => {
    expect(getAmountEquivalent('Infinity%', 100)).toEqual(null)
  })

  it('non-finite dollar input -> hidden', () => {
    expect(getAmountEquivalent('Infinity', 100)).toEqual(null)
  })

  it('non-finite base -> hidden', () => {
    expect(getAmountEquivalent('20%', Infinity)).toEqual(null)
  })

  it('invalid percent input -> hidden', () => {
    expect(getAmountEquivalent('abc%', 100)).toEqual(null)
  })

  it('invalid dollar input -> hidden', () => {
    expect(getAmountEquivalent('abc', 100)).toEqual(null)
  })

  it('trims whitespace', () => {
    expect(getAmountEquivalent('  20%  ', 100)).toEqual('$20.00')
  })

  it('trailing-zero percent equivalents are trimmed', () => {
    expect(getAmountEquivalent('20.10', 100)).toEqual('20.1%')
  })
})

describe('parseAmount', () => {
  it('empty string → 0', () => {
    expect(parseAmount('', 100)).toEqual(0)
  })
  it('whitespace-only → 0', () => {
    expect(parseAmount('   ', 100)).toEqual(0)
  })
  it('plain number', () => {
    expect(parseAmount('10.50', 100)).toEqual(10.5)
  })
  it('percentage of base', () => {
    expect(parseAmount('20%', 100)).toEqual(20)
  })
  it('percentage of zero base', () => {
    expect(parseAmount('20%', 0)).toEqual(0)
  })
  it('negative flat amount', () => {
    expect(parseAmount('-5', 100)).toEqual(-5)
  })
  it('negative percentage', () => {
    expect(parseAmount('-10%', 100)).toEqual(-10)
  })
  it('invalid string → 0', () => {
    expect(parseAmount('abc', 100)).toEqual(0)
  })
  it('invalid percent → 0', () => {
    expect(parseAmount('abc%', 100)).toEqual(0)
  })
  it('bare "%" → 0', () => {
    expect(parseAmount('%', 100)).toEqual(0)
  })
})

describe('reconcileCents', () => {
  it('even split needs no adjustment', () => {
    const result = reconcileCents([5, 5], 10)
    expect(result).toEqual([5, 5])
  })
  it('three-way split: sum of rounded shares equals total in cents', () => {
    const result = reconcileCents([10 / 3, 10 / 3, 10 / 3], 10)
    expect(sumCents(result)).toEqual(1000)
    expect(result.length).toEqual(3)
  })
  it('three-way split: each share is either 3.33 or 3.34', () => {
    const result = reconcileCents([10 / 3, 10 / 3, 10 / 3], 10)
    for (const v of result) {
      const cents = Math.round(v * 100)
      if (cents !== 333 && cents !== 334) throw new Error(`unexpected share ${v}`)
    }
  })
  it('empty array → empty array', () => {
    expect(reconcileCents([], 0)).toEqual([])
  })
  it('single participant: floating-point residue rounded to total', () => {
    // 10 / 3 * 3 = 10.000000000000002 in IEEE 754; reconcile to clean $10.00
    const rawTotal = 10 / 3 * 3
    const result = reconcileCents([rawTotal], rawTotal)
    expect(Math.round(result[0] * 100)).toEqual(1000)
  })
  it('four-way even split unchanged', () => {
    const result = reconcileCents([2.5, 2.5, 2.5, 2.5], 10)
    expect(result).toEqual([2.5, 2.5, 2.5, 2.5])
  })
})

describe('calculateBreakdown', () => {
  it('two people, one item, no tax/tip', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalSubtotal).toEqual(10)
    expect(bd.totalGrandTotal).toEqual(10)
    expect(bd.perPerson.length).toEqual(2)
    expect(bd.perPerson[0].subtotal).toEqual(5)
    expect(bd.perPerson[1].subtotal).toEqual(5)
  })

  it('three-way split: per-person subtotals sum to total in cents', () => {
    const s = state({
      participants: [p('A'), p('B'), p('C')],
      items: [item('x', '10')],
    })
    const bd = calculateBreakdown(s)
    expect(sumCents(bd.perPerson.map(pp => pp.subtotal))).toEqual(1000)
    expect(bd.totalSubtotal.toFixed(2)).toEqual((10.000000000000002).toFixed(2))
  })

  it('item assigned to explicit subset', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10', ['A'])],
    })
    const bd = calculateBreakdown(s)
    const a = bd.perPerson.find(pp => pp.participantId === 'A')!
    const b = bd.perPerson.find(pp => pp.participantId === 'B')!
    expect(a.subtotal).toEqual(10)
    expect(b.subtotal).toEqual(0)
  })

  it('item assigned to nobody (assignedTo=[]) is skipped', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10', [])],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalSubtotal).toEqual(0)
  })

  it('item with invalid price is skipped', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', 'abc')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalSubtotal).toEqual(0)
  })

  it('tax applies to taxable items only', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [
        item('taxable', '10'),
        item('nontaxable', '6', null, false),
      ],
      tax: '10%',
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalSubtotal).toEqual(16)
    expect(bd.totalTaxableSubtotal).toEqual(10)
    expect(bd.totalTax).toEqual(1)
    expect(bd.totalGrandTotal).toEqual(17)
  })

  it('all items non-taxable → tax is $0 even with a tax value set', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10', null, false)],
      tax: '10%',
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(0)
    expect(bd.perPerson[0].tax).toEqual(0)
  })

  it('flat tax splits proportionally by taxable subtotal', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [
        item('a1', '6', ['A']),
        item('b1', '4', ['B']),
      ],
      tax: '1',
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(1)
    const a = bd.perPerson.find(pp => pp.participantId === 'A')!
    const b = bd.perPerson.find(pp => pp.participantId === 'B')!
    expect(a.tax).toEqual(0.6)
    expect(b.tax).toEqual(0.4)
  })

  it('tip pre-tax base', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
      tax: '10%',
      tip: '10%',
      tipBase: 'pre-tax',
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(1)
  })

  it('tip post-tax base', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
      tax: '10%',
      tip: '10%',
      tipBase: 'post-tax',
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(1.1)
  })

  it('additional fee (surcharge)', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
      additionalFees: [fee('svc', '2')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalAdditionalFees[0]).toEqual(2)
    expect(bd.perPerson[0].additionalFees[0]).toEqual(1)
    expect(bd.perPerson[1].additionalFees[0]).toEqual(1)
  })

  it('additional fee as discount (negative amount)', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
      additionalFees: [fee('coupon', '-2')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalAdditionalFees[0]).toEqual(-2)
    expect(bd.perPerson[0].additionalFees[0]).toEqual(-1)
  })

  it('no participants → empty perPerson', () => {
    const s = state({ items: [item('x', '10')] })
    const bd = calculateBreakdown(s)
    expect(bd.perPerson.length).toEqual(0)
    expect(bd.totalSubtotal).toEqual(0)
  })

  it('grand totals: sum of per-person grands equals totalGrandTotal', () => {
    const s = state({
      participants: [p('A'), p('B'), p('C')],
      items: [item('x', '10'), item('y', '7')],
      tax: '8%',
      tip: '18%',
    })
    const bd = calculateBreakdown(s)
    const sumGrand = bd.perPerson.reduce((a, pp) => a + pp.grandTotal, 0)
    expect(Math.round(sumGrand * 100)).toEqual(Math.round(bd.totalGrandTotal * 100))
  })
})

describe('calculateSettlement', () => {
  it('single payer: other participants owe their share', () => {
    const participants = [p('A'), p('B')]
    const s = state({
      participants,
      items: [item('x', '10')],
      payerMode: 'single',
      singlePayerId: 'A',
    })
    const bd = calculateBreakdown(s)
    const txns = calculateSettlement(s, bd)
    expect(txns.length).toEqual(1)
    expect(txns[0].fromId).toEqual('B')
    expect(txns[0].toId).toEqual('A')
    expect(txns[0].amount).toEqual(5)
  })

  it('multiple payers: net difference settles correctly', () => {
    const participants = [p('A'), p('B')]
    const s = state({
      participants,
      items: [item('x', '10')],
      payerMode: 'multiple',
      amountPaid: { A: '8', B: '2' },
    })
    const bd = calculateBreakdown(s)
    const txns = calculateSettlement(s, bd)
    expect(txns.length).toEqual(1)
    expect(txns[0].fromId).toEqual('B')
    expect(txns[0].toId).toEqual('A')
    expect(txns[0].amount).toEqual(3)
  })

  it('already settled: no transactions', () => {
    const participants = [p('A'), p('B')]
    const s = state({
      participants,
      items: [item('x', '10')],
      payerMode: 'multiple',
      amountPaid: { A: '5', B: '5' },
    })
    const bd = calculateBreakdown(s)
    const txns = calculateSettlement(s, bd)
    expect(txns.length).toEqual(0)
  })

  it('three-way: transaction amounts are whole cents', () => {
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
      expect(Math.round(t.amount * 100) / 100).toEqual(t.amount)
    }
  })

  it('three-way: settlement transactions sum to total owed by non-payers', () => {
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
    expect(Math.round(totalPaid * 100)).toEqual(Math.round((bShare + cShare) * 100))
  })

  it('singlePayerId not in participants → no paid credit assigned', () => {
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
    expect(txns.length).toEqual(0)
  })

  it('settlement with overpayment: payer is owed the difference', () => {
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
    expect(txns.length).toEqual(1)
    expect(txns[0].fromId).toEqual('B')
    expect(txns[0].toId).toEqual('A')
    expect(txns[0].amount).toEqual(5)
  })

  it('settlement nets all within 0.005 threshold: no transactions', () => {
    const participants = [p('A'), p('B')]
    const s = state({
      participants,
      items: [item('x', '10')],
      payerMode: 'multiple',
      amountPaid: { A: '5.002', B: '4.998' }, // nets < 0.005, both within threshold
    })
    const bd = calculateBreakdown(s)
    const txns = calculateSettlement(s, bd)
    expect(txns.length).toEqual(0)
  })
})

describe('calculateBreakdown (edge cases)', () => {
  it('additional fee on post-tax base', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10')],
      tax: '10%', // $1 tax, totalSubtotal = $10, post-tax = $11
      additionalFees: [fee('svc', '10%', 'post-tax')], // 10% of $11 = $1.10
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(1)
    expect(bd.totalAdditionalFees[0]).toEqual(1.1)
  })

  it('flat pre-tax discount reduces the tax base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('coupon', '-20')], // pre-tax by default
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(8)
  })

  it('percentage pre-tax discount reduces the tax base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('coupon', '-20%')], // -20% of $100 = -$20, pre-tax
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(8)
  })

  it('post-tax discount does not affect the tax base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('coupon', '-20', 'post-tax')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(10)
  })

  it('pre-tax discount larger than taxable subtotal clamps tax base to 0', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('coupon', '-150')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(0)
  })

  it('pre-tax surcharge increases the tax base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('svc', '20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(12)
  })

  it('pre-tax surcharge does not create a tax base when nothing is taxable', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100', null, false)], // non-taxable
      tax: '10%',
      additionalFees: [fee('svc', '20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(0)
  })

  it('flat fee when pool base is 0 splits evenly', () => {
    // No items → subtotal = 0, fee base = 0, distributeProportionally falls back to even split
    const s = state({
      participants: [p('A'), p('B')],
      items: [],
      additionalFees: [fee('svc', '2')], // $2 flat fee with zero pool
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalAdditionalFees[0]).toEqual(2)
    expect(bd.perPerson[0].additionalFees[0]).toEqual(1)
    expect(bd.perPerson[1].additionalFees[0]).toEqual(1)
  })

  it('3-way negative discount splits proportionally', () => {
    const s = state({
      participants: [p('A'), p('B'), p('C')],
      items: [item('x', '30')], // $10 each
      additionalFees: [fee('coupon', '-3')], // -$3 total = -$1 each
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalAdditionalFees[0]).toEqual(-3)
    for (const pp of bd.perPerson) {
      expect(pp.additionalFees[0]).toEqual(-1)
    }
  })

  it('item assigned to id not in participants is silently skipped', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('x', '10', ['ghost'])], // 'ghost' is not a participant
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalSubtotal).toEqual(0)
    expect(bd.perPerson[0].subtotal).toEqual(0)
    expect(bd.perPerson[1].subtotal).toEqual(0)
  })
})

describe('tip discount/fee base', () => {
  it('tip defaults ignore a pre-tax discount', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      additionalFees: [fee('coupon', '-20')], // pre-tax by default
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(10)
  })

  it('post-discount toggle nets the coupon out of the tip base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      tipDiscountBase: 'post-discount',
      additionalFees: [fee('coupon', '-20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(8)
  })

  it('tip defaults ignore a pre-tax surcharge', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      additionalFees: [fee('svc', '20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(10)
  })

  it('post-fee toggle nets the surcharge into the tip base', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      tipFeeBase: 'post-fee',
      additionalFees: [fee('svc', '20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(12)
  })

  it('post-tax fee base is corrected by a coexisting pre-tax discount', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '10%',
      additionalFees: [fee('coupon', '-20'), fee('svc', '10%', 'post-tax')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTax).toEqual(8)
    expect(bd.totalAdditionalFees[1]).toEqual(8.8)
  })

  it('percentage-based discount exercises the same %-parsing path as flat amounts', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      tipDiscountBase: 'post-discount',
      additionalFees: [fee('coupon', '-20%')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(8)
  })

  it('percentage-based surcharge exercises the same %-parsing path as flat amounts', () => {
    const s = state({
      participants: [p('A')],
      items: [item('x', '100')],
      tax: '0%',
      tip: '10%',
      tipFeeBase: 'post-fee',
      additionalFees: [fee('svc', '20%')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(12)
  })

  it('multi-participant tip distribution stays proportional to raw shares', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('a', '60', ['A']), item('b', '40', ['B'])],
      tax: '0%',
      tip: '10%',
      tipDiscountBase: 'post-discount',
      additionalFees: [fee('coupon', '-20')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalTip).toEqual(8)
    expect(bd.perPerson[0].tip).toEqual(4.8)
    expect(bd.perPerson[1].tip).toEqual(3.2)
  })

  it('multi-participant post-tax fee distribution stays proportional with a coexisting discount', () => {
    const s = state({
      participants: [p('A'), p('B')],
      items: [item('a', '50', ['A']), item('b', '50', ['B'])],
      tax: '10%',
      additionalFees: [fee('coupon', '-20'), fee('svc', '10%', 'post-tax')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.totalAdditionalFees[1]).toEqual(8.8)
    expect(bd.perPerson[0].additionalFees[1]).toEqual(4.4)
    expect(bd.perPerson[1].additionalFees[1]).toEqual(4.4)
  })

  it('reproduces the real Kura Sushi receipt end-to-end', () => {
    const s = state({
      participants: [p('A')],
      items: [item('plates', '112.05'), item('soup', '4.95')],
      tax: '9.75%',
      tip: '10%',
      tipDiscountBase: 'post-discount',
      additionalFees: [fee('coupon', '-10')],
    })
    const bd = calculateBreakdown(s)
    expect(bd.perPerson[0].tax).toEqual(10.43)
    expect(bd.perPerson[0].tip).toEqual(10.7)
  })
})

describe('isValidAmount', () => {
  it('empty string is valid (treated as 0)', () => {
    expect(isValidAmount('')).toEqual(true)
  })
  it('whitespace-only is valid', () => {
    expect(isValidAmount('   ')).toEqual(true)
  })
  it('plain number is valid', () => {
    expect(isValidAmount('12.50')).toEqual(true)
  })
  it('negative number is valid (discount)', () => {
    expect(isValidAmount('-5')).toEqual(true)
  })
  it('percentage is valid', () => {
    expect(isValidAmount('20%')).toEqual(true)
  })
  it('negative percentage is valid', () => {
    expect(isValidAmount('-10%')).toEqual(true)
  })
  it('non-numeric string is invalid', () => {
    expect(isValidAmount('abc')).toEqual(false)
  })
  it('non-numeric percent is invalid', () => {
    expect(isValidAmount('abc%')).toEqual(false)
  })
  it('Infinity is invalid', () => {
    expect(isValidAmount('Infinity')).toEqual(false)
  })
  it('Infinity% is invalid', () => {
    expect(isValidAmount('Infinity%')).toEqual(false)
  })
})

describe('isValidPrice', () => {
  it('empty string is valid', () => {
    expect(isValidPrice('')).toEqual(true)
  })
  it('positive number is valid', () => {
    expect(isValidPrice('9.99')).toEqual(true)
  })
  it('zero is valid', () => {
    expect(isValidPrice('0')).toEqual(true)
  })
  it('negative number is invalid (prices are non-negative)', () => {
    expect(isValidPrice('-5')).toEqual(false)
  })
  it('percentage string is invalid for prices', () => {
    expect(isValidPrice('10%')).toEqual(false)
  })
  it('non-numeric string is invalid', () => {
    expect(isValidPrice('abc')).toEqual(false)
  })
  it('Infinity is invalid', () => {
    expect(isValidPrice('Infinity')).toEqual(false)
  })
})

describe('getTotalFeeBase', () => {
  it('pre-tax base returns subtotal only', () => {
    expect(getTotalFeeBase('pre-tax', 100, 10)).toEqual(100)
  })
  it('post-tax base returns subtotal + tax', () => {
    expect(getTotalFeeBase('post-tax', 100, 10)).toEqual(110)
  })
  it('pre-tax with zero tax is just subtotal', () => {
    expect(getTotalFeeBase('pre-tax', 50, 0)).toEqual(50)
  })
  it('post-tax with zero tax is still subtotal', () => {
    expect(getTotalFeeBase('post-tax', 50, 0)).toEqual(50)
  })
})

describe('parsePaidAmount', () => {
  it('valid number string', () => {
    expect(parsePaidAmount('12.50')).toEqual(12.5)
  })
  it('undefined returns 0', () => {
    expect(parsePaidAmount(undefined)).toEqual(0)
  })
  it('empty string returns 0', () => {
    expect(parsePaidAmount('')).toEqual(0)
  })
  it('non-numeric string returns 0', () => {
    expect(parsePaidAmount('abc')).toEqual(0)
  })
  it('Infinity string returns 0', () => {
    expect(parsePaidAmount('Infinity')).toEqual(0)
  })
  it('-Infinity string returns 0', () => {
    expect(parsePaidAmount('-Infinity')).toEqual(0)
  })
})

describe('splitAmountInput', () => {
  it('plain number: not percent, numeric preserved', () => {
    expect(splitAmountInput('10.50')).toEqual({ isPercent: false, numeric: '10.50' })
  })
  it('percent string: isPercent true, % stripped', () => {
    expect(splitAmountInput('20%')).toEqual({ isPercent: true, numeric: '20' })
  })
  it('bare %: isPercent true, numeric empty', () => {
    expect(splitAmountInput('%')).toEqual({ isPercent: true, numeric: '' })
  })
  it('empty string: not percent, numeric empty', () => {
    expect(splitAmountInput('')).toEqual({ isPercent: false, numeric: '' })
  })
  it('whitespace trimmed', () => {
    expect(splitAmountInput('  15%  ')).toEqual({ isPercent: true, numeric: '15' })
  })
  it('negative percent', () => {
    expect(splitAmountInput('-10%')).toEqual({ isPercent: true, numeric: '-10' })
  })
})
