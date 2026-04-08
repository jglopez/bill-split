import type { BillState } from '../types'

// Base defaults used when a v1 payload is missing fields. Items are omitted
// here because the migration always computes them from the v1 data.
const BILL_V2_DEFAULTS: Omit<BillState, 'items'> = {
  participants: [],
  tax: '',
  tip: '',
  tipBase: 'pre-tax',
  additionalFees: [],
  payerMode: 'single',
  singlePayerId: '',
  amountPaid: {},
}

// v1 → v2: the "assigned to all" sentinel changed from [] to null.
export function migrateV1toBillV2(raw: unknown): BillState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid v1 bill state: expected object')
  }
  const v1 = raw as Record<string, unknown>

  const rawItems = v1['items']
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    throw new Error('Invalid v1 bill state: items must be an array')
  }
  const items: BillState['items'] = (rawItems ?? []).map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid v1 bill state: each item must be an object')
    }
    const { assignedTo, ...rest } = item as Record<string, unknown>
    let normalized: string[] | null
    if (assignedTo === null || assignedTo === undefined) {
      normalized = null
    } else if (!Array.isArray(assignedTo)) {
      throw new Error('Invalid v1 bill state: item.assignedTo must be null or string[]')
    } else if (assignedTo.length === 0) {
      normalized = null // v1 "all" sentinel → v2 null
    } else {
      if (!assignedTo.every((id: unknown) => typeof id === 'string')) {
        throw new Error('Invalid v1 bill state: item.assignedTo must contain only strings')
      }
      normalized = assignedTo as string[]
    }
    return { ...rest, assignedTo: normalized } as BillState['items'][number]
  })

  return { ...BILL_V2_DEFAULTS, ...v1, items }
}
