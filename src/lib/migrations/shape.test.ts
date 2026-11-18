// Tripwire for schema changes that skip a version bump. If this fails because
// you changed BillState, follow the checklist in ./index.ts, then update the
// expected shape below together with the new version number.

import { describe, it, expect } from 'vitest'
import { CURRENT_BILL_VERSION } from './index'
import { FULL_BILL_SAMPLE } from './shape'

const keys = (o: object) => Object.keys(o).sort()

describe('bill schema shape', () => {
  it('matches the shape recorded for the current version', () => {
    const actual = {
      version: CURRENT_BILL_VERSION,
      bill: keys(FULL_BILL_SAMPLE),
      participant: keys(FULL_BILL_SAMPLE.participants[0]),
      item: keys(FULL_BILL_SAMPLE.items[0]),
      fee: keys(FULL_BILL_SAMPLE.additionalFees[0]),
    }
    expect(
      actual,
      'BillState shape changed: bump CURRENT_BILL_VERSION and add a migration (see src/lib/migrations/index.ts)',
    ).toEqual({
      version: 2,
      bill: [
        'additionalFees', 'amountPaid', 'items', 'participants', 'payerMode', 'singlePayerId',
        'tax', 'tip', 'tipBase', 'tipDiscountBase', 'tipFeeBase',
      ],
      participant: ['id', 'name'],
      item: ['assignedTo', 'id', 'name', 'price', 'taxable'],
      fee: ['amount', 'base', 'id', 'name'],
    })
  })
})
