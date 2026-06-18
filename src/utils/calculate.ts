import type { BillState, FeesBase } from '../types'

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Split a trimmed amount string into its percent flag and numeric part.
 * A trailing "%" means percent mode; the numeric part has the "%" stripped.
 */
export function splitAmountInput(value: string): { isPercent: boolean; numeric: string } {
  const trimmed = value.trim()
  const isPercent = trimmed.endsWith('%')
  return { isPercent, numeric: isPercent ? trimmed.slice(0, -1) : trimmed }
}

/**
 * Parse a user-entered amount string relative to a base dollar amount.
 * A trailing "%" means the value is a percentage of `base`.
 * Anything else is treated as a flat dollar amount.
 * Returns 0 for empty, unparseable, or NaN inputs.
 */
export function parseAmount(value: string, base: number): number {
  const { isPercent, numeric } = splitAmountInput(value)
  if (!numeric && !isPercent) return 0
  if (isPercent) {
    const pct = Number(numeric)
    return isNaN(pct) ? 0 : (pct / 100) * base
  }
  const n = Number(numeric)
  return isNaN(n) ? 0 : n
}

/** Returns true if a string is a syntactically valid amount ($ or %). */
export function isValidAmount(value: string): boolean {
  const { isPercent, numeric } = splitAmountInput(value)
  if (!numeric && !isPercent) return true // empty is allowed (treated as 0)
  const n = Number(numeric)
  return !isNaN(n) && isFinite(n)
}

/**
 * Returns true if a string is a valid item price (non-negative plain number, no % suffix).
 * Item prices are always dollar amounts; percentage inputs are not valid here.
 */
export function isValidPrice(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  const n = Number(trimmed)
  return !isNaN(n) && isFinite(n) && n >= 0
}

// ─── Equivalent display ────────────────────────────────────────────────────

/**
 * Number of decimal places that give ~3 significant figures for a percentage,
 * capped at 3 decimals (so very small percentages may show fewer than 3 sig
 * figs rather than growing decimals without bound).
 */
function significantDecimals(n: number): number {
  const abs = Math.abs(n)
  if (abs === 0 || abs >= 100) return 0
  if (abs >= 10) return 1
  if (abs >= 1) return 2
  return 3
}

/**
 * Round a dollar amount to 2 decimals, prefixed with "~" only when that
 * rounding actually lost precision. Exact 2-decimal values are shown plain.
 * Negative amounts (e.g. the dollar equivalent of a percent discount) are
 * shown as "-$5.00", not "$-5.00".
 */
function formatDollar(n: number): string {
  const rounded = Math.round(n * 100) / 100
  const isExact = Math.abs(n - rounded) < 1e-9
  const prefix = isExact ? '' : '~'
  const sign = rounded < 0 ? '-' : ''
  return `${prefix}${sign}$${Math.abs(rounded).toFixed(2)}`
}

/**
 * Round a percentage to ~3 significant figures (see `significantDecimals`),
 * prefixed with "~" only when that rounding actually lost precision.
 */
function formatPercent(n: number): string {
  const decimals = significantDecimals(n)
  const factor = 10 ** decimals
  const rounded = Math.round(n * factor) / factor
  const isExact = Math.abs(n - rounded) < 1e-9
  const prefix = isExact ? '' : '~'
  const fixed = rounded.toFixed(decimals)
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
  return `${prefix}${trimmed}%`
}

/**
 * Given a tax/tip/fee amount string and the dollar base it's calculated
 * against, return the equivalent value in the other unit ($ if the input is
 * a %, % if the input is a $ amount). Returns null when there's nothing
 * sensible to show: empty/bare/invalid/non-finite input, a non-finite base,
 * or a $-to-% conversion against a zero or negative base.
 */
export function getAmountEquivalent(value: string, base: number): string | null {
  const { isPercent, numeric } = splitAmountInput(value)
  if ((!numeric && !isPercent) || !isFinite(base)) return null
  if (isPercent) {
    if (!numeric) return null // bare "%" (e.g. mid-toggle with no digits yet)
    const pct = Number(numeric)
    if (isNaN(pct) || !isFinite(pct)) return null
    return formatDollar((pct / 100) * base)
  }
  const n = Number(numeric)
  if (isNaN(n) || !isFinite(n) || base <= 0) return null
  return formatPercent((n / base) * 100)
}

// ─── Per-person breakdown ────────────────────────────────────────────────────

export interface PersonBreakdown {
  participantId: string
  subtotal: number
  tax: number
  tip: number
  additionalFees: number[] // parallel to BillState.additionalFees
  grandTotal: number
}

export interface BillBreakdown {
  totalSubtotal: number
  totalTaxableSubtotal: number
  totalTax: number
  totalTip: number
  totalAdditionalFees: number[] // parallel to BillState.additionalFees
  totalGrandTotal: number
  perPerson: PersonBreakdown[]
}

/** Resolve the base amount for a proportional fee given its base setting. */
export function getTotalFeeBase(base: FeesBase, totalSubtotal: number, totalTax: number): number {
  return base === 'post-tax' ? totalSubtotal + totalTax : totalSubtotal
}

/**
 * Distribute a proportional fee across participants.
 * Each person's share is proportional to their `base` amount vs the pool total.
 * If the pool total is 0, the fee is split evenly to avoid division by zero.
 */
function distributeProportionally(
  feeTotal: number,
  personBases: number[],
  poolTotal: number,
): number[] {
  if (poolTotal === 0 || personBases.length === 0) {
    const even = feeTotal / (personBases.length || 1)
    return personBases.map(() => even)
  }
  return personBases.map(b => (b / poolTotal) * feeTotal)
}

/**
 * Apply largest-remainder cent reconciliation to a set of shares so that
 * toFixed(2) on each share sums to toFixed(2) on the total.
 *
 * Without this, splitting $10 three ways gives three $3.33 cells (= $9.99)
 * under a $10.00 total. The largest-remainder method distributes the extra
 * penny to the participant(s) with the biggest fractional cent remainder.
 */
export function reconcileCents(shares: number[], total: number): number[] {
  if (shares.length === 0) return shares
  const totalCents = Math.round(total * 100)
  const floored = shares.map(s => Math.floor(Math.round(s * 1000) / 10))
  const remainders = shares.map((s, i) => Math.round(s * 1000) / 10 - floored[i])
  const flooredSum = floored.reduce((a, b) => a + b, 0)
  const extra = totalCents - flooredSum
  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
  const result = [...floored]
  for (let j = 0; j < extra && j < order.length; j++) {
    result[order[j].i]++
  }
  return result.map(cents => cents / 100)
}

/**
 * Calculate the full per-person breakdown from the current bill state.
 * All math is pure; no side effects.
 */
export function calculateBreakdown(state: BillState): BillBreakdown {
  const { participants, items, tax, tip, tipBase, additionalFees } = state

  // Per-person item subtotals (all items) and taxable-only subtotals
  const subtotals: Record<string, number> = {}
  const taxableSubtotals: Record<string, number> = {}
  for (const p of participants) {
    subtotals[p.id] = 0
    taxableSubtotals[p.id] = 0
  }

  for (const item of items) {
    const price = Number(item.price)
    if (isNaN(price) || price <= 0) continue
    const assigned =
      item.assignedTo === null ? participants.map(p => p.id) : item.assignedTo
    if (assigned.length === 0) continue // no one assigned to this item
    const share = price / assigned.length
    for (const id of assigned) {
      if (id in subtotals) {
        subtotals[id] += share
        if (item.taxable !== false) taxableSubtotals[id] += share
      }
    }
  }

  const totalSubtotal = Object.values(subtotals).reduce((a, b) => a + b, 0)
  const taxableTotal = Object.values(taxableSubtotals).reduce((a, b) => a + b, 0)

  // Reconcile per-person item subtotals to whole cents so displayed shares sum
  // to the displayed total. Subtotals are derived from item-by-item division so
  // they accumulate floating-point residue before reconciliation.
  const reconciledSubtotals = reconcileCents(
    participants.map(p => subtotals[p.id]),
    totalSubtotal,
  )

  // Tax: on taxable items only. When nothing is taxable the tax is $0 regardless
  // of whether a flat or percentage amount was entered.
  const taxTotal = taxableTotal === 0 ? 0 : parseAmount(tax, taxableTotal)
  const taxShares = reconcileCents(
    distributeProportionally(
      taxTotal,
      participants.map(p => taxableSubtotals[p.id]),
      taxableTotal,
    ),
    taxTotal,
  )

  // Helper: resolve the base amount for a single person's proportional fee share
  function getFeeBase(base: FeesBase, personSubtotal: number, personTax: number): number {
    return base === 'post-tax' ? personSubtotal + personTax : personSubtotal
  }

  // Tip
  const tipTotalBase = getTotalFeeBase(tipBase, totalSubtotal, taxTotal)
  const tipTotal = parseAmount(tip, tipTotalBase)
  const tipShares = reconcileCents(
    distributeProportionally(
      tipTotal,
      participants.map((_p, i) => getFeeBase(tipBase, reconciledSubtotals[i], taxShares[i])),
      tipTotalBase,
    ),
    tipTotal,
  )

  // Additional fees (surcharges and discounts)
  const totalAdditionalFees = additionalFees.map(fee => {
    const feeBase = getTotalFeeBase(fee.base, totalSubtotal, taxTotal)
    return parseAmount(fee.amount, feeBase)
  })

  const additionalFeeShares: number[][] = additionalFees.map((fee, fi) => {
    const feeBase = getTotalFeeBase(fee.base, totalSubtotal, taxTotal)
    return reconcileCents(
      distributeProportionally(
        totalAdditionalFees[fi],
        participants.map((_p, i) => getFeeBase(fee.base, reconciledSubtotals[i], taxShares[i])),
        feeBase,
      ),
      totalAdditionalFees[fi],
    )
  })

  const perPerson: PersonBreakdown[] = participants.map((p, i) => {
    const subtotal = reconciledSubtotals[i]
    const taxShare = taxShares[i]
    const tipShare = tipShares[i]
    const feeShares = additionalFeeShares.map(shares => shares[i])
    const grandTotal =
      subtotal + taxShare + tipShare + feeShares.reduce((a, b) => a + b, 0)
    return {
      participantId: p.id,
      subtotal,
      tax: taxShare,
      tip: tipShare,
      additionalFees: feeShares,
      grandTotal,
    }
  })

  // Grand totals are sums of reconciled whole-cent values, so they are already
  // in whole cents; no further reconciliation needed.
  const totalGrandTotal = perPerson.reduce((a, p) => a + p.grandTotal, 0)

  return {
    totalSubtotal,
    totalTaxableSubtotal: taxableTotal,
    totalTax: taxTotal,
    totalTip: tipTotal,
    totalAdditionalFees,
    totalGrandTotal,
    perPerson,
  }
}

// ─── Settlement ──────────────────────────────────────────────────────────────

export interface Transaction {
  fromId: string
  toId: string
  amount: number
}

/**
 * Given what each person owes and what they paid, compute the minimal set of
 * transactions to settle all debts.
 *
 * Uses a greedy algorithm: repeatedly pair the person who owes the most with
 * the person owed the most. This minimizes the number of transactions when
 * net balances are non-degenerate.
 */
export function calculateSettlement(
  state: BillState,
  breakdown: BillBreakdown,
): Transaction[] {
  const { participants, payerMode, singlePayerId, amountPaid } = state

  // Build paid map
  const paid: Record<string, number> = {}
  for (const p of participants) paid[p.id] = 0

  if (payerMode === 'single') {
    if (singlePayerId && singlePayerId in paid) {
      paid[singlePayerId] = breakdown.totalGrandTotal
    }
  } else {
    for (const p of participants) {
      const val = Number(amountPaid[p.id] ?? '')
      paid[p.id] = isNaN(val) ? 0 : val
    }
  }

  // net[id] = grandTotal_owed - amount_paid
  // positive → they owe money to the group
  // negative → they're owed money by the group
  const net: Record<string, number> = {}
  for (const p of breakdown.perPerson) {
    net[p.participantId] = p.grandTotal - paid[p.participantId]
  }

  // Greedy debt simplification
  const debtors: { id: string; amount: number }[] = []
  const creditors: { id: string; amount: number }[] = []
  for (const [id, n] of Object.entries(net)) {
    if (n > 0.005) debtors.push({ id, amount: n })
    else if (n < -0.005) creditors.push({ id, amount: -n })
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transactions: Transaction[] = []
  let di = 0
  let ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]
    const creditor = creditors[ci]
    const amount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100
    transactions.push({ fromId: debtor.id, toId: creditor.id, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount < 0.005) di++
    if (creditor.amount < 0.005) ci++
  }

  return transactions
}
