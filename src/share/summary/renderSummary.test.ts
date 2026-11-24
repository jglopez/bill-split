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
      Total: $93.11

      Chris pays Alice $31.68
      Bob pays Alice $14.57"
    `)
  })

  it('shows every person and payment with the same amounts as the data', () => {
    const text = renderSummary(sample)
    for (const p of sample.people) expect(text).toContain(`${p.name}: ${formatMoney(p.total)}`)
    for (const s of sample.settlements) expect(text).toContain(`${s.from} pays ${s.to} ${formatMoney(s.amount)}`)
    expect(text).toContain(`Total: ${formatMoney(sample.totals.grandTotal)}`)
  })

  it('uses a generic title for an unnamed bill and leaves out an empty settlement', () => {
    expect(renderSummary(minimal)).toBe('Bill split\n\nAlice: $10.00\nTotal: $10.00')
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
