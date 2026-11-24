import { describe, expect, it } from 'vitest'
import { buildShareData } from './shareData'
import { sampleBill } from './fixtures/sampleBill'
import { calculateBreakdown, calculateSettlement } from '../utils/calculate'
import type { BillState } from '../types'

const cents = (n: number) => Math.round(n * 100) / 100

describe('buildShareData', () => {
  const breakdown = calculateBreakdown(sampleBill)
  const transactions = calculateSettlement(sampleBill, breakdown)
  const data = buildShareData(sampleBill)

  it('trims the bill name and participant names', () => {
    expect(data.name).toBe("Dinner at Rosa's")
    expect(data.people.map(p => p.name)).toEqual(['Alice', 'Bob', 'Chris'])
  })

  it('drops control characters a pasted name can carry', () => {
    const bill: BillState = {
      ...sampleBill,
      name: 'Din\tner\u0002',
      participants: [{ id: 'a', name: 'A\u0002li\u0003ce\n' }],
      additionalFees: [{ id: 'f', name: 'Cou\u007fpon', amount: '-1', base: 'pre-tax' }],
    }
    const data = buildShareData(bill)
    expect(data.name).toBe('Dinner')
    expect(data.people[0].name).toBe('Alice')
    expect(data.totals.fees[0].name).toBe('Coupon')
  })

  it('gives each person the grand total from the breakdown, in participant order', () => {
    expect(data.people.map(p => p.id)).toEqual(['a', 'b', 'c'])
    for (const person of data.people) {
      const row = breakdown.perPerson.find(p => p.participantId === person.id)
      expect(person.total).toBe(cents(row!.grandTotal))
    }
  })

  it('carries the bill totals from the breakdown', () => {
    expect(data.totals.subtotal).toBe(cents(breakdown.totalSubtotal))
    expect(data.totals.tax).toBe(cents(breakdown.totalTax))
    expect(data.totals.tip).toBe(cents(breakdown.totalTip))
    expect(data.totals.grandTotal).toBe(cents(breakdown.totalGrandTotal))
  })

  it('lists fees that change the bill, with a generic name when unnamed', () => {
    expect(data.totals.fees).toEqual([
      { name: 'Coupon', amount: cents(breakdown.totalAdditionalFees[0]) },
      { name: 'Fee', amount: cents(breakdown.totalAdditionalFees[1]) },
    ])
    expect(data.totals.fees[0].amount).toBeLessThan(0)
  })

  it('names an unnamed discount "Discount"', () => {
    const bill: BillState = {
      ...sampleBill,
      additionalFees: [{ id: 'f', name: ' ', amount: '-1', base: 'pre-tax' }],
    }
    expect(buildShareData(bill).totals.fees).toEqual([{ name: 'Discount', amount: -1 }])
  })

  it('matches the settlement transaction for transaction, with names resolved', () => {
    expect(data.settlements).toEqual(
      transactions.map(t => ({
        fromId: t.fromId,
        from: data.people.find(p => p.id === t.fromId)!.name,
        toId: t.toId,
        to: data.people.find(p => p.id === t.toId)!.name,
        amount: cents(t.amount),
      })),
    )
    expect(data.settlements.length).toBeGreaterThan(0)
  })

  it('people totals add up to the grand total', () => {
    const sum = data.people.reduce((s, p) => s + p.total, 0)
    expect(cents(sum)).toBe(data.totals.grandTotal)
  })

  it('reuses a breakdown and settlement the caller already has', () => {
    expect(buildShareData(sampleBill, breakdown, transactions)).toEqual(data)
  })

  it('has no settlements when nobody owes anybody', () => {
    const solo: BillState = { ...sampleBill, participants: [{ id: 'a', name: 'Alice' }] }
    expect(buildShareData(solo).settlements).toEqual([])
  })
})
