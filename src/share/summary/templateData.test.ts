import { describe, expect, it } from 'vitest'
import { toSummaryTemplateData } from './templateData'
import { buildShareData } from '../shareData'
import { sampleBill } from '../fixtures/sampleBill'

/** Every key path in a value, with array items collapsed to `[]`. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix, ...keyPaths(value[0], `${prefix}[]`)]
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
  }
  return [prefix]
}

describe('toSummaryTemplateData', () => {
  const share = buildShareData(sampleBill)
  const data = toSummaryTemplateData(share)

  it('carries the share data the templates need', () => {
    expect(data.name).toBe(share.name)
    expect(data.people).toEqual(share.people.map(({ name, total }) => ({ name, total })))
    expect(data.totals).toEqual(share.totals)
    expect(data.settlements).toEqual(share.settlements.map(({ from, to, amount }) => ({ from, to, amount })))
  })

  it('passes the bill link through, and leaves it empty when there is none', () => {
    expect(data.link).toBe('')
    expect(toSummaryTemplateData(share, 'https://example.test/#b=1.x').link).toBe('https://example.test/#b=1.x')
  })

  // Templates depend on these fields. Adding one is fine (update this list
  // and the docs in templateData.ts); renaming or removing one breaks
  // templates, which is why this list is pinned.
  it('exposes exactly the documented fields', () => {
    expect(keyPaths(data).filter(Boolean).sort()).toEqual([
      'link',
      'name',
      'people',
      'people[].name',
      'people[].total',
      'settlements',
      'settlements[].amount',
      'settlements[].from',
      'settlements[].to',
      'totals.fees',
      'totals.fees[].amount',
      'totals.fees[].name',
      'totals.grandTotal',
      'totals.subtotal',
      'totals.tax',
      'totals.tip',
    ])
  })
})
