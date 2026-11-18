// Schema step v2 → v3: tipDiscountBase and tipFeeBase become required.
//
// Bills saved before those options existed don't have them. Until now they
// were filled in on every load; this step fills them in once, with the same
// defaults (tip ignores pre-tax discounts and surcharges), so the current
// schema can require them.
//
// Like every step, this describes its output with local types instead of
// importing BillState, so later schema changes can't alter what it produces.

export interface V3Bill extends Record<string, unknown> {
  tipDiscountBase: unknown
  tipFeeBase: unknown
}

export function migrate(raw: unknown): V3Bill {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid v2 bill state: expected object')
  }
  const v2 = raw as Record<string, unknown>
  // Only absent values are filled in. A present but invalid value is passed
  // through, so validation of the result still rejects it.
  return {
    ...v2,
    tipDiscountBase: v2['tipDiscountBase'] ?? 'pre-discount',
    tipFeeBase: v2['tipFeeBase'] ?? 'pre-fee',
  }
}
