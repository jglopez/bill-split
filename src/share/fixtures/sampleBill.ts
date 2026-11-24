import type { BillState } from '../../types'

/**
 * A dinner for three that exercises every part of the share data: shared and
 * personal items, tax, tip, a named discount, an unnamed fee, and one payer.
 * Names carry stray spaces on purpose, to check they're trimmed.
 */
export const sampleBill: BillState = {
  name: ' Dinner at Rosa\'s ',
  participants: [
    { id: 'a', name: 'Alice' },
    { id: 'b', name: ' Bob ' },
    { id: 'c', name: 'Chris' },
  ],
  items: [
    { id: 'i1', name: 'Pizza', price: '36', assignedTo: null },
    { id: 'i2', name: 'Salad', price: '12.50', assignedTo: ['a'] },
    { id: 'i3', name: 'Wine', price: '30', assignedTo: ['a', 'c'], taxable: false },
    { id: 'i4', name: '', price: '', assignedTo: null },
  ],
  tax: '8%',
  tip: '18%',
  tipBase: 'pre-tax',
  tipDiscountBase: 'pre-discount',
  tipFeeBase: 'pre-fee',
  additionalFees: [
    { id: 'f1', name: 'Coupon', amount: '-5', base: 'pre-tax' },
    { id: 'f2', name: '', amount: '2', base: 'post-tax' },
    { id: 'f3', name: 'Empty', amount: '', base: 'pre-tax' },
  ],
  payerMode: 'single',
  singlePayerId: 'a',
  amountPaid: {},
}
