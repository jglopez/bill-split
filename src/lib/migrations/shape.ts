// A bill with every field filled in, used by shape.test.ts to notice when the
// BillState shape changes without a schema version bump. `satisfies Required`
// makes adding any field, even an optional one, a type error here until this
// sample is updated, and the test then asks for a version bump.
// Not imported by the app.

import type { AdditionalFee, BillState, Item, Participant } from '../../types'

const participant = { id: 'p', name: 'Alex' } satisfies Required<Participant>

const item = {
  id: 'i',
  name: 'Pizza',
  price: '24.00',
  assignedTo: null,
  taxable: true,
} satisfies Required<Item>

const fee = { id: 'f', name: 'Service', amount: '3%', base: 'pre-tax' } satisfies Required<AdditionalFee>

export const FULL_BILL_SAMPLE = {
  name: 'Dinner',
  participants: [participant],
  items: [item],
  tax: '',
  tip: '',
  tipBase: 'pre-tax',
  tipDiscountBase: 'pre-discount',
  tipFeeBase: 'pre-fee',
  additionalFees: [fee],
  payerMode: 'single',
  singlePayerId: '',
  amountPaid: {},
} satisfies Required<BillState>
