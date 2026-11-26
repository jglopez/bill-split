import type { BillState } from '../types'
import {
  calculateBreakdown,
  calculateSettlement,
  type BillBreakdown,
  type Transaction,
} from '../utils/calculate'

/**
 * Everything a share method needs to describe a bill, with names resolved and
 * amounts already computed. Every share method (text summary, export, payment
 * requests) builds from this one shape, so none of them repeats the math in
 * calculate.ts or disagrees with what the app shows.
 *
 * It is format-neutral on purpose: amounts are plain numbers in dollars,
 * rounded to whole cents, and nothing in it is shaped for one output format.
 */
export interface ShareData {
  /** The bill's title, trimmed, without control characters. Empty when the bill is unnamed. */
  name: string
  /** One entry per participant, in participant order. */
  people: SharePerson[]
  totals: ShareTotals
  /** The payments that settle the bill. Empty when nobody owes anybody. */
  settlements: ShareSettlement[]
}

export interface SharePerson {
  id: string
  /** The participant's name, trimmed, without control characters. */
  name: string
  /** What this person's share of the bill comes to, including tax, tip and fees. */
  total: number
}

export interface ShareTotals {
  subtotal: number
  tax: number
  tip: number
  /**
   * Surcharges and discounts that change the bill, in the order entered.
   * Discounts are negative. Fees that come to zero are left out, as in the
   * app's summary.
   */
  fees: ShareFee[]
  grandTotal: number
}

export interface ShareFee {
  /** The fee's name, or a generic label when it has none. */
  name: string
  amount: number
}

export interface ShareSettlement {
  fromId: string
  from: string
  toId: string
  to: string
  amount: number
}

/**
 * Trim a typed name and drop control characters (tabs, newlines and the
 * like), which a pasted name can carry and which no share format wants.
 */
function cleanName(name: string): string {
  return Array.from(name)
    .filter(ch => {
      const code = ch.charCodeAt(0)
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .trim()
}

/**
 * The title a bill-wide share carries, for targets that show one (such as the
 * share sheet's preview or an email subject). Every bill-wide method uses it
 * so they read the same; a bill with no name falls back to the app name.
 */
export function billShareTitle(name: string): string {
  const bill = cleanName(name)
  return bill ? `Bill split for ${bill}` : 'Bill split'
}

/** Round to whole cents, so every consumer sees the same amounts the app shows. */
function cents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Build the share data for a bill. Pass the breakdown and settlement when the
 * caller has already computed them, to avoid doing the work twice.
 */
export function buildShareData(
  state: BillState,
  breakdown: BillBreakdown = calculateBreakdown(state),
  transactions: Transaction[] = calculateSettlement(state, breakdown),
): ShareData {
  const nameById = new Map(state.participants.map(p => [p.id, cleanName(p.name)]))
  const totalById = new Map(breakdown.perPerson.map(p => [p.participantId, p.grandTotal]))

  const fees: ShareFee[] = []
  state.additionalFees.forEach((fee, i) => {
    const amount = cents(breakdown.totalAdditionalFees[i] ?? 0)
    if (amount === 0) return
    fees.push({ name: cleanName(fee.name) || (amount < 0 ? 'Discount' : 'Fee'), amount })
  })

  return {
    name: cleanName(state.name),
    people: state.participants.map(p => ({
      id: p.id,
      name: cleanName(p.name),
      total: cents(totalById.get(p.id) ?? 0),
    })),
    totals: {
      subtotal: cents(breakdown.totalSubtotal),
      tax: cents(breakdown.totalTax),
      tip: cents(breakdown.totalTip),
      fees,
      grandTotal: cents(breakdown.totalGrandTotal),
    },
    // Settlement ids always come from the participant list, so a missing name
    // only happens with corrupt state; show it the way the app does.
    settlements: transactions.map(t => ({
      fromId: t.fromId,
      from: nameById.get(t.fromId) ?? '?',
      toId: t.toId,
      to: nameById.get(t.toId) ?? '?',
      amount: cents(t.amount),
    })),
  }
}
