// ─── Bill link format 1 ───────────────────────────────────────────────────────
//
// Packs a bill at schema v4 into a compact JSON array before compression.
// Links in this format are already shared, so never change what this file
// reads. When the bill schema moves on, add a new format next to this one and
// leave this file as it is: links in this format are upgraded by the bill
// migrations instead.
//
// The packed layout drops field names and ids. Participants are referred to
// by their position in the list, and the blank row that the app keeps at the
// end of the items isn't stored. Layout:
//
//   [ name, peopleNames, items, tax, tip, tipFlags, fees, payer ]
//
//   items:    [ name, price, assigned, notTaxable? ][]
//             assigned is null (everyone) or a list of participant positions;
//             notTaxable is 1 when the item is excluded from tax, left out otherwise.
//   tipFlags: bit 0 tip after tax, bit 1 tip after discounts, bit 2 tip after fees.
//   fees:     [ name, amount, afterTax (0 or 1) ][]
//   payer:    [ multiple (0 or 1), singlePayer position or -1, amountsPaid ]
//             amountsPaid holds one string per participant, in order.
//
// Types here describe schema v4 on purpose, not the current BillState, so this
// file stays fixed as the schema changes.

import { nanoid } from 'nanoid'

export const SCHEMA_VERSION = 4

interface ParticipantV4 { id: string; name: string }
interface ItemV4 { id: string; name: string; price: string; assignedTo: string[] | null; taxable?: boolean }
interface FeeV4 { id: string; name: string; amount: string; base: 'pre-tax' | 'post-tax' }
export interface BillV4 {
  name: string
  participants: ParticipantV4[]
  items: ItemV4[]
  tax: string
  tip: string
  tipBase: 'pre-tax' | 'post-tax'
  tipDiscountBase: 'pre-discount' | 'post-discount'
  tipFeeBase: 'pre-fee' | 'post-fee'
  additionalFees: FeeV4[]
  payerMode: 'single' | 'multiple'
  singlePayerId: string
  amountPaid: Record<string, string>
}

const TIP_AFTER_TAX = 1
const TIP_AFTER_DISCOUNTS = 2
const TIP_AFTER_FEES = 4

/** The packed data isn't a valid format 1 bill. */
export class PackedShapeError extends Error {
  constructor(what: string) {
    super(`Bill link data is malformed: ${what}`)
    this.name = 'PackedShapeError'
  }
}

export function pack(bill: BillV4): unknown[] {
  const position = new Map(bill.participants.map((p, i) => [p.id, i]))
  const positions = (ids: string[]) =>
    ids.flatMap(id => (position.has(id) ? [position.get(id)!] : []))

  const items = bill.items.filter(item => item.name !== '' || item.price !== '')

  let tipFlags = 0
  if (bill.tipBase === 'post-tax') tipFlags |= TIP_AFTER_TAX
  if (bill.tipDiscountBase === 'post-discount') tipFlags |= TIP_AFTER_DISCOUNTS
  if (bill.tipFeeBase === 'post-fee') tipFlags |= TIP_AFTER_FEES

  return [
    bill.name,
    bill.participants.map(p => p.name),
    items.map(item => {
      const packed: unknown[] = [item.name, item.price, item.assignedTo === null ? null : positions(item.assignedTo)]
      if (item.taxable === false) packed.push(1)
      return packed
    }),
    bill.tax,
    bill.tip,
    tipFlags,
    bill.additionalFees.map(fee => [fee.name, fee.amount, fee.base === 'post-tax' ? 1 : 0]),
    [
      bill.payerMode === 'multiple' ? 1 : 0,
      position.get(bill.singlePayerId) ?? -1,
      bill.participants.map(p => bill.amountPaid[p.id] ?? ''),
    ],
  ]
}

function check(condition: boolean, what: string): asserts condition {
  if (!condition) throw new PackedShapeError(what)
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isFlag = (v: unknown): v is 0 | 1 => v === 0 || v === 1

/** Unpack format 1 data into a v4 bill with fresh ids. Throws PackedShapeError on anything unexpected. */
export function unpack(data: unknown): BillV4 {
  check(Array.isArray(data) && data.length === 8, 'top level')
  const [name, names, items, tax, tip, tipFlags, fees, payer] = data as unknown[]

  check(isString(name), 'name')
  check(Array.isArray(names) && names.every(isString), 'participants')
  const participants = names.map(n => ({ id: nanoid(), name: n }))
  const idAt = (i: unknown): string => {
    check(Number.isInteger(i) && (i as number) >= 0 && (i as number) < participants.length, 'participant position')
    return participants[i as number].id
  }

  check(Array.isArray(items), 'items')
  const unpackedItems = items.map((raw): ItemV4 => {
    check(Array.isArray(raw) && (raw.length === 3 || raw.length === 4), 'item')
    const [itemName, price, assigned, notTaxable] = raw as unknown[]
    check(isString(itemName) && isString(price), 'item text')
    check(assigned === null || Array.isArray(assigned), 'item assignment')
    check(raw.length === 3 || notTaxable === 1, 'item taxable flag')
    const item: ItemV4 = {
      id: nanoid(),
      name: itemName,
      price,
      assignedTo: assigned === null ? null : [...new Set(assigned.map(idAt))],
    }
    if (notTaxable === 1) item.taxable = false
    return item
  })

  check(isString(tax) && isString(tip), 'tax and tip')
  check(Number.isInteger(tipFlags) && (tipFlags as number) >= 0 && (tipFlags as number) < 8, 'tip options')
  const flags = tipFlags as number

  check(Array.isArray(fees), 'fees')
  const additionalFees = fees.map((raw): FeeV4 => {
    check(Array.isArray(raw) && raw.length === 3, 'fee')
    const [feeName, amount, afterTax] = raw as unknown[]
    check(isString(feeName) && isString(amount) && isFlag(afterTax), 'fee fields')
    return { id: nanoid(), name: feeName, amount, base: afterTax === 1 ? 'post-tax' : 'pre-tax' }
  })

  check(Array.isArray(payer) && payer.length === 3, 'payer')
  const [multiple, single, paid] = payer as unknown[]
  check(isFlag(multiple), 'payer mode')
  check(Array.isArray(paid) && paid.length === participants.length && paid.every(isString), 'amounts paid')
  const amountPaid: Record<string, string> = {}
  paid.forEach((amount, i) => { if (amount !== '') amountPaid[participants[i].id] = amount })

  return {
    name,
    participants,
    items: unpackedItems,
    tax,
    tip,
    tipBase: flags & TIP_AFTER_TAX ? 'post-tax' : 'pre-tax',
    tipDiscountBase: flags & TIP_AFTER_DISCOUNTS ? 'post-discount' : 'pre-discount',
    tipFeeBase: flags & TIP_AFTER_FEES ? 'post-fee' : 'pre-fee',
    additionalFees,
    payerMode: multiple === 1 ? 'multiple' : 'single',
    singlePayerId: single === -1 ? '' : idAt(single),
    amountPaid,
  }
}
