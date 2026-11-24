import { describe, expect, it } from 'vitest'
import { renderSummary, renderSummaryHtml, SummaryTemplateError } from './renderSummary'
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

describe('renderSummaryHtml', () => {
  it('renders the sample bill with the title and total in bold', () => {
    expect(renderSummaryHtml(sample)).toMatchInlineSnapshot(`"<div><b>Dinner at Rosa's</b><br><br>Alice: $46.86<br>Bob: $14.57<br>Chris: $31.68<br><br>Subtotal: $78.50<br>Tax: $3.48<br>Tip: $14.13<br>Coupon: −$5.00<br>Fee: $2.00<br><b>Total: $93.11</b></div>"`)
  })

  it('has the same text and line breaks as the plain summary', () => {
    const html = renderSummaryHtml(sample)
    const text = html.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&#39;/g, "'")
    expect(text).toBe(renderSummary(sample))
  })

  it('escapes names, so they show as typed and add no markup', () => {
    const html = renderSummaryHtml({ ...minimal, name: '<i>Tom & "Jerry"</i>' })
    expect(html).toContain('<b>&lt;i&gt;Tom &amp; &quot;Jerry&quot;&lt;/i&gt;</b>')
  })

  it('fails the same way as the plain summary on a bad template', () => {
    expect(() => renderSummaryHtml(minimal, 'Hi {{ nmae }}')).toThrow(SummaryTemplateError)
  })
})

describe('renderSummary with a custom template', () => {
  it('leaves bold text unmarked in plain text', () => {
    expect(renderSummary(minimal, '{{ "Hi" | bold }} there')).toBe('Hi there')
  })

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
