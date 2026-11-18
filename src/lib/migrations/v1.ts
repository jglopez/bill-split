// Schema step v1 → v2: the "assigned to all" sentinel changed from [] to null.
//
// This step describes the v2 shape with its own local types instead of
// importing BillState, so later schema changes can't silently alter what this
// step produces. The step after it takes this output as its input.

export interface V2Item extends Record<string, unknown> {
  id: string
  name: string
  price: string
  assignedTo: string[] | null
}

export interface V2Bill extends Record<string, unknown> {
  items: V2Item[]
}

// Defaults used when a v1 payload is missing fields. Items are omitted here
// because the migration always computes them from the v1 data.
const V2_DEFAULTS = {
  participants: [],
  tax: '',
  tip: '',
  tipBase: 'pre-tax',
  tipDiscountBase: 'pre-discount',
  tipFeeBase: 'pre-fee',
  additionalFees: [],
  payerMode: 'single',
  singlePayerId: '',
  amountPaid: {},
}

export function migrate(raw: unknown): V2Bill {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid v1 bill state: expected object')
  }
  const v1 = raw as Record<string, unknown>

  const rawItems = v1['items']
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    throw new Error('Invalid v1 bill state: items must be an array')
  }
  const items: V2Item[] = (rawItems ?? []).map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid v1 bill state: each item must be an object')
    }
    const obj = item as Record<string, unknown>
    if (typeof obj['id'] !== 'string') {
      throw new Error('Invalid v1 bill state: item.id must be a string')
    }
    if (typeof obj['price'] !== 'string') {
      throw new Error('Invalid v1 bill state: item.price must be a string')
    }
    if (typeof obj['name'] !== 'string') {
      throw new Error('Invalid v1 bill state: item.name must be a string')
    }
    const { assignedTo, ...rest } = obj
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
    return { ...rest, assignedTo: normalized } as V2Item
  })

  return { ...V2_DEFAULTS, ...v1, items }
}
