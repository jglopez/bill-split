import { describe, expect, it } from 'vitest'
import type { BillState } from '../../types'
import { CURRENT_BILL_VERSION } from '../../lib/migrations'
import {
  LATEST_LINK_FORMAT,
  MalformedLinkError,
  NewerLinkError,
  billLinkUrl,
  decodeBillHash,
  encodeBillHash,
  formats,
} from './billLink'
import { BILL_HASH_PREFIX } from './hash'

// Swap ids for names so two bills compare by content. Ids are regenerated
// whenever a link is opened, so they never match.
function byName(bill: BillState) {
  const name = new Map(bill.participants.map(p => [p.id, p.name]))
  const names = (ids: string[]) => ids.map(id => name.get(id))
  return {
    name: bill.name,
    participants: bill.participants.map(p => p.name),
    items: bill.items
      .filter(i => i.name !== '' || i.price !== '')
      .map(({ name: n, price, assignedTo, taxable }) => ({
        name: n,
        price,
        assignedTo: assignedTo === null ? null : names(assignedTo),
        ...(taxable === false ? { taxable } : {}),
      })),
    tax: bill.tax,
    tip: bill.tip,
    tipBase: bill.tipBase,
    tipDiscountBase: bill.tipDiscountBase,
    tipFeeBase: bill.tipFeeBase,
    additionalFees: bill.additionalFees.map(({ name: n, amount, base }) => ({ name: n, amount, base })),
    payerMode: bill.payerMode,
    singlePayer: name.get(bill.singlePayerId) ?? '',
    amountPaid: Object.fromEntries(
      Object.entries(bill.amountPaid).filter(([, v]) => v !== '').map(([id, v]) => [name.get(id), v]),
    ),
  }
}

const people = ['Alice', 'Bob', 'Chris', 'Dana'].map((n, i) => ({ id: `p${i}`, name: n }))

// Roughly the bill the issue measured: 4 people, 15 items, plus fees and
// amounts paid. It encodes to about 400 characters of data.
const dinner: BillState = {
  name: 'Friday dinner',
  participants: people,
  items: [
    ...['Margherita', 'Pepperoni', 'Garlic bread', 'Caesar salad', 'Wings', 'Fries', 'Lemonade',
      'Iced tea', 'IPA', 'Lager', 'Tiramisu', 'Gelato', 'Espresso', 'Calamari', 'Bruschetta',
    ].map((n, i) => ({
      id: `i${i}`,
      name: n,
      price: `${(8 + i * 1.75).toFixed(2)}`,
      assignedTo: i % 3 === 0 ? null : [people[i % 4].id, people[(i + 1) % 4].id],
      ...(i === 6 ? { taxable: false } : {}),
    })),
    { id: 'blank', name: '', price: '', assignedTo: null },
  ],
  tax: '8.875%',
  tip: '20%',
  tipBase: 'post-tax',
  tipDiscountBase: 'post-discount',
  tipFeeBase: 'pre-fee',
  additionalFees: [
    { id: 'f1', name: 'Coupon', amount: '-10%', base: 'pre-tax' },
    { id: 'f2', name: 'Service', amount: '3.50', base: 'post-tax' },
  ],
  payerMode: 'multiple',
  singlePayerId: 'p1',
  amountPaid: { p0: '100', p2: '42.17' },
}

describe('bill links', () => {
  it('round-trips a bill', async () => {
    expect(byName(await decodeBillHash(encodeBillHash(dinner)))).toEqual(byName(dinner))
  })

  it('round-trips unicode, empty names and an unset payer', async () => {
    const bill: BillState = {
      ...dinner,
      name: 'Café 🍕 "night"',
      participants: [{ id: 'x', name: 'Zoë' }, { id: 'y', name: '' }],
      items: [{ id: 'i', name: 'Crème brûlée', price: '9', assignedTo: [] }],
      additionalFees: [],
      payerMode: 'single',
      singlePayerId: '',
      amountPaid: {},
    }
    expect(byName(await decodeBillHash(encodeBillHash(bill)))).toEqual(byName(bill))
  })

  it('gives opened bills fresh ids and keeps assignments pointing at the right people', async () => {
    const opened = await decodeBillHash(encodeBillHash(dinner))
    expect(opened.participants.map(p => p.id)).not.toContain('p0')
    const ids = new Set(opened.participants.map(p => p.id))
    for (const item of opened.items) for (const id of item.assignedTo ?? []) expect(ids.has(id)).toBe(true)
  })

  it('drops references to people who are not on the bill', async () => {
    const bill: BillState = {
      ...dinner,
      items: [{ id: 'i', name: 'Ghost', price: '1', assignedTo: ['p0', 'gone'] }],
      singlePayerId: 'gone',
      amountPaid: { gone: '5' },
    }
    const opened = byName(await decodeBillHash(encodeBillHash(bill)))
    expect(opened.items[0].assignedTo).toEqual(['Alice'])
    expect(opened.singlePayer).toBe('')
    expect(opened.amountPaid).toEqual({})
  })

  it('keeps a typical bill short enough for a text message', () => {
    const data = encodeBillHash(dinner).slice(BILL_HASH_PREFIX.length)
    expect(data.length).toBeLessThan(450)
  })

  it('uses only characters that survive in a URL fragment unescaped', () => {
    expect(encodeBillHash(dinner)).toMatch(/^#b=\d+\.[A-Za-z0-9_-]+$/)
  })

  it('builds a full link from the app address', () => {
    const hash = encodeBillHash(dinner)
    expect(billLinkUrl(dinner, 'https://example.test/split/')).toBe(`https://example.test/split/${hash}`)
    expect(billLinkUrl(dinner, 'https://example.test/#old')).toBe(`https://example.test/${hash}`)
  })

  describe('formats', () => {
    // Pinned links, one per format. Never edit these: they stand for links
    // already shared.
    const pinned = import.meta.glob<{ hash: string; bill: unknown }>('./fixtures/format*.json', {
      eager: true,
      import: 'default',
    })
    const formatNumbers = Object.keys(formats).map(Number)

    it('writes new links in the format for the current bill schema', () => {
      expect(
        formats[LATEST_LINK_FORMAT].SCHEMA_VERSION,
        'The bill schema changed: add a new link format in src/share/link/formats/ and make it the latest',
      ).toBe(CURRENT_BILL_VERSION)
      expect(Math.max(...formatNumbers)).toBe(LATEST_LINK_FORMAT)
    })

    it.each(formatNumbers)('format %i has a pinned link that still opens', async format => {
      const fixture = pinned[`./fixtures/format${format}.json`]
      expect(fixture, `Missing src/share/link/fixtures/format${format}.json`).toBeDefined()
      expect(fixture.hash.startsWith(`${BILL_HASH_PREFIX}${format}.`)).toBe(true)
      expect(byName(await decodeBillHash(fixture.hash))).toEqual(fixture.bill)
    })
  })

  describe('links it cannot open', () => {
    const good = encodeBillHash(dinner)

    it('asks for an update when the link is from a newer app', async () => {
      await expect(decodeBillHash(`${BILL_HASH_PREFIX}${LATEST_LINK_FORMAT + 1}.AAAA`)).rejects.toBeInstanceOf(NewerLinkError)
    })

    it.each([
      ['not a bill link', '#other'],
      ['no format number', `${BILL_HASH_PREFIX}abc`],
      ['format 0', `${BILL_HASH_PREFIX}0.${good.split('.')[1]}`],
      ['no data', `${BILL_HASH_PREFIX}1.`],
      ['bad characters', `${BILL_HASH_PREFIX}1.ab+c/`],
      ['random data', `${BILL_HASH_PREFIX}1.SGVsbG8gd29ybGQ`],
      ['truncated', good.slice(0, Math.floor(good.length * 0.6))],
      ['one character short', good.slice(0, -1)],
    ])('rejects %s as malformed', async (_, hash) => {
      await expect(decodeBillHash(hash)).rejects.toBeInstanceOf(MalformedLinkError)
    })
  })
})
