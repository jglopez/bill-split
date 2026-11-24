import type { ShareData } from '../shareData'

/**
 * The data a summary template sees. This is a contract with every template,
 * including any a user might write one day, so it changes only by adding
 * fields. Never rename or remove a field, or change what one means.
 *
 * Amounts are numbers in dollars. Templates only format them, for example
 * with the `money` filter, and never compute new amounts: everything a
 * template might want to show is already here.
 *
 * Fields:
 * - `name`: the bill's title, or an empty string when it has none.
 * - `people`: `{ name, total }` for each participant, in participant order.
 *   `total` is that person's whole share, including tax, tip and fees.
 * - `totals`: `{ subtotal, tax, tip, fees, grandTotal }` for the whole bill.
 *   `fees` is a list of `{ name, amount }`; discounts are negative.
 * - `settlements`: `{ from, to, amount }` for each payment that settles the
 *   bill. Empty when nobody owes anybody.
 * - `link`: a link that opens this bill in the app, or an empty string when
 *   there isn't one.
 */
export interface SummaryTemplateData {
  name: string
  people: { name: string; total: number }[]
  totals: {
    subtotal: number
    tax: number
    tip: number
    fees: { name: string; amount: number }[]
    grandTotal: number
  }
  settlements: { from: string; to: string; amount: number }[]
  link: string
}

/**
 * Map share data to template data. Fields are copied one by one, so a change
 * to ShareData never reaches templates unless it's added here on purpose.
 * The bill link isn't part of ShareData because building it needs code that
 * loads separately (see src/share/link/), so callers pass it in.
 */
export function toSummaryTemplateData(share: ShareData, link = ''): SummaryTemplateData {
  return {
    name: share.name,
    people: share.people.map(p => ({ name: p.name, total: p.total })),
    totals: {
      subtotal: share.totals.subtotal,
      tax: share.totals.tax,
      tip: share.totals.tip,
      fees: share.totals.fees.map(f => ({ name: f.name, amount: f.amount })),
      grandTotal: share.totals.grandTotal,
    },
    settlements: share.settlements.map(s => ({ from: s.from, to: s.to, amount: s.amount })),
    link,
  }
}
