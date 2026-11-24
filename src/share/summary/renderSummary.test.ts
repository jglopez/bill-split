import { describe, expect, it } from 'vitest'
import { renderSummary, SummaryTemplateError } from './renderSummary'
import { toSummaryTemplateData, type SummaryTemplateData } from './templateData'
import { buildShareData } from '../shareData'
import { sampleBill } from '../fixtures/sampleBill'
import { formatMoney } from '../../utils/format'

const sample = toSummaryTemplateData(buildShareData(sampleBill))

const minimal: SummaryTemplateData = {
  name: '',
  people: [{ name: 'Alice', total: 10 }],
  totals: { subtotal: 10, tax: 0, tip: 0, fees: [], grandTotal: 10 },
  settlements: [],
}

describe('renderSummary with the default template', () => {
  it('renders the sample bill', () => {
    expect(renderSummary(sample)).toMatchInlineSnapshot(`
      "Dinner at Rosa's

      Alice: $46.86
      Bob: $14.57
      Chris: $31.68

      Subtotal: $78.50
      Tax: $3.48
      Tip: $14.13
      Coupon: −$5.00
      Fee: $2.00
      Total: $93.11"
    `)
  })

  it('shows every person, in bill order, and every total with the same amounts as the data', () => {
    const lines = renderSummary(sample).split('\n')
    const personLines = sample.people.map(p => `${p.name}: ${formatMoney(p.total)}`)
    expect(lines.filter(l => personLines.includes(l))).toEqual(personLines)
    expect(lines.slice(-(4 + sample.totals.fees.length))).toEqual([
      `Subtotal: ${formatMoney(sample.totals.subtotal)}`,
      `Tax: ${formatMoney(sample.totals.tax)}`,
      `Tip: ${formatMoney(sample.totals.tip)}`,
      ...sample.totals.fees.map(f => `${f.name}: ${formatMoney(f.amount)}`),
      `Total: ${formatMoney(sample.totals.grandTotal)}`,
    ])
  })

  it('uses a generic title for an unnamed bill and leaves out zero tax and tip', () => {
    expect(renderSummary(minimal)).toBe('Bill split\n\nAlice: $10.00\n\nSubtotal: $10.00\nTotal: $10.00')
  })
})

describe('renderSummary with a custom template', () => {
  it('renders the given template instead of the default', () => {
    expect(renderSummary(minimal, '{{ people[0].name }} owes {{ totals.grandTotal | money }}'))
      .toBe('Alice owes $10.00')
  })

  it('formats negative amounts the way the app does', () => {
    expect(renderSummary(minimal, '{{ -5.5 | money }}')).toBe('−$5.50')
  })

  it('trims trailing spaces and blank lines at the ends', () => {
    expect(renderSummary(minimal, '\n\n  a  \nb\t\n\n')).toBe('  a\nb')
  })

  const failures: [string, string][] = [
    ['an unclosed tag', 'Hi {% if name %}{{ name }}'],
    ['a malformed expression', 'Hi {% if %}x{% endif %}'],
    ['an unknown variable', 'Hi {{ nmae }}'],
    ['an unknown filter', 'Hi {{ name | shout }}'],
    ['money on something that is not a number', 'Hi {{ name | money }}'],
    ['an include, which has nothing to load', "Hi {% include 'other' %}"],
    ['a prototype member', 'Hi {{ name.constructor }}'],
  ]

  for (const [what, template] of failures) {
    it(`fails with a clear error, and no partial output, on ${what}`, () => {
      let result: string | undefined
      let error: unknown
      try {
        result = renderSummary(minimal, template)
      } catch (e) {
        error = e
      }
      expect(result).toBeUndefined()
      expect(error).toBeInstanceOf(SummaryTemplateError)
      expect((error as Error).message).toMatch(/^Summary template failed: \S/)
    })
  }

  it('stops a runaway template instead of hanging', () => {
    const template = '{% for i in (1..100000000) %}x{% endfor %}'
    expect(() => renderSummary(minimal, template)).toThrow(SummaryTemplateError)
  })
})
