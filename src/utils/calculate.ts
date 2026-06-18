import type { BillState, FeesBase } from '../types'

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Parse a user-entered amount string relative to a base dollar amount.
 * A trailing "%" means the value is a percentage of `base`.
 * Anything else is treated as a flat dollar amount.
 * Returns 0 for empty, unparseable, or NaN inputs.
 */
export function parseAmount(value: string, base: number): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (trimmed.endsWith('%')) {
    const pct = Number(trimmed.slice(0, -1))
    return isNaN(pct) ? 0 : (pct / 100) * base
  }
  const n = Number(trimmed)
  return isNaN(n) ? 0 : n
}

/** Returns true if a string is a syntactically valid amount ($ or %). */
export function isValidAmount(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true // empty is allowed (treated as 0)
  const raw = trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed
  const n = Number(raw)
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
  const trimmed = value.trim()
  if (!trimmed || !isFinite(base)) return null
  const isPercent = trimmed.endsWith('%')
  if (isPercent) {
    const numericPart = trimmed.slice(0, -1)
    if (!numericPart) return null // bare "%" (e.g. mid-toggle with no digits yet)
    const pct = Number(numericPart)
    if (isNaN(pct) || !isFinite(pct)) return null
    return formatDollar((pct / 100) * base)
  }
  const n = Number(trimmed)
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

  // Tax: on taxable items only. When nothing is taxable the tax is $0 regardless
  // of whether a flat or percentage amount was entered.
  const taxTotal = taxableTotal === 0 ? 0 : parseAmount(tax, taxableTotal)
  const taxShares = distributeProportionally(
    taxTotal,
    participants.map(p => taxableSubtotals[p.id]),
    taxableTotal,
  )

  // Helper: resolve the base amount for a single person's proportional fee share
  function getFeeBase(base: FeesBase, personSubtotal: number, personTax: number): number {
    return base === 'post-tax' ? personSubtotal + personTax : personSubtotal
  }

  // Tip
  const tipTotalBase = getTotalFeeBase(tipBase, totalSubtotal, taxTotal)
  const tipTotal = parseAmount(tip, tipTotalBase)
  const tipShares = distributeProportionally(
    tipTotal,
    participants.map((p, i) => getFeeBase(tipBase, subtotals[p.id], taxShares[i])),
    tipTotalBase,
  )

  // Additional fees (surcharges and discounts)
  const additionalFeeShares: number[][] = additionalFees.map(fee => {
    const feeBase = getTotalFeeBase(fee.base, totalSubtotal, taxTotal)
    const feeTotal = parseAmount(fee.amount, feeBase)
    return distributeProportionally(
      feeTotal,
      participants.map((p, i) => getFeeBase(fee.base, subtotals[p.id], taxShares[i])),
      feeBase,
    )
  })

  const totalAdditionalFees = additionalFees.map(fee => {
    const feeBase = getTotalFeeBase(fee.base, totalSubtotal, taxTotal)
    return parseAmount(fee.amount, feeBase)
  })

  const perPerson: PersonBreakdown[] = participants.map((p, i) => {
    const subtotal = subtotals[p.id]
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
    const amount = Math.min(debtor.amount, creditor.amount)
    transactions.push({ fromId: debtor.id, toId: creditor.id, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount < 0.005) di++
    if (creditor.amount < 0.005) ci++
  }

  return transactions
}
