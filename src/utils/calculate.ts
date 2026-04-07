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
    const pct = parseFloat(trimmed.slice(0, -1))
    return isNaN(pct) ? 0 : (pct / 100) * base
  }
  const n = parseFloat(trimmed)
  return isNaN(n) ? 0 : n
}

/** Returns true if a string is a syntactically valid amount ($ or %). */
export function isValidAmount(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true // empty is allowed (treated as 0)
  const raw = trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed
  return !isNaN(parseFloat(raw)) && isFinite(Number(raw))
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
  totalTax: number
  totalTip: number
  totalAdditionalFees: number[] // parallel to BillState.additionalFees
  totalGrandTotal: number
  perPerson: PersonBreakdown[]
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

  // Per-person item subtotals
  const subtotals: Record<string, number> = {}
  for (const p of participants) subtotals[p.id] = 0

  for (const item of items) {
    const price = parseFloat(item.price)
    if (isNaN(price) || price <= 0) continue
    const assigned =
      item.assignedTo.length === 0 ? participants.map(p => p.id) : item.assignedTo
    const share = price / assigned.length
    for (const id of assigned) {
      if (id in subtotals) subtotals[id] += share
    }
  }

  const totalSubtotal = Object.values(subtotals).reduce((a, b) => a + b, 0)

  // Tax: always on item subtotal
  const taxTotal = parseAmount(tax, totalSubtotal)
  const taxShares = distributeProportionally(
    taxTotal,
    participants.map(p => subtotals[p.id]),
    totalSubtotal,
  )

  // Helper: resolve the base amount for a proportional fee given its base setting
  function getFeeBase(base: FeesBase, personSubtotal: number, personTax: number): number {
    return base === 'post-tax' ? personSubtotal + personTax : personSubtotal
  }
  function getTotalFeeBase(base: FeesBase): number {
    return base === 'post-tax' ? totalSubtotal + taxTotal : totalSubtotal
  }

  // Tip
  const tipTotalBase = getTotalFeeBase(tipBase)
  const tipTotal = parseAmount(tip, tipTotalBase)
  const tipShares = distributeProportionally(
    tipTotal,
    participants.map((p, i) => getFeeBase(tipBase, subtotals[p.id], taxShares[i])),
    tipTotalBase,
  )

  // Additional fees (surcharges and discounts)
  const additionalFeeShares: number[][] = additionalFees.map(fee => {
    const feeBase = getTotalFeeBase(fee.base)
    const feeTotal = parseAmount(fee.amount, feeBase)
    return distributeProportionally(
      feeTotal,
      participants.map((p, i) => getFeeBase(fee.base, subtotals[p.id], taxShares[i])),
      feeBase,
    )
  })

  const totalAdditionalFees = additionalFees.map(fee => {
    const feeBase = getTotalFeeBase(fee.base)
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
      const val = parseFloat(amountPaid[p.id] ?? '')
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
