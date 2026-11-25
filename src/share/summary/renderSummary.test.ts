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
  link: '',
}

describe('renderSummary with the default template', () => {
  it('lists people in participant order after a reorder', () => {
    const [a, b, c] = sampleBill.participants
    const text = renderSummary(toSummaryTemplateData(buildShareData({ ...sampleBill, participants: [c, a, b] })))
    const lines = text.split('\n').filter(line => /^(Alice|Bob|Chris):/.test(line))
    expect(lines.map(line => line.split(':')[0])).toEqual(['Chris', 'Alice', 'Bob'])
  })

  it('renders the sample bill', () => {
    expect(renderSummary(sample)).toMatchInlineSnapshot(`
      "Dinner at Rosa's

      Alice: $46.86
      Bob: $14.57
      Chris: $31.68

      Tax, tip, fees, and discounts are included."
    `)
  })

  it('shows every person, in bill order, with the same amounts as the data', () => {
    const lines = renderSummary(sample).split('\n')
    const personLines = sample.people.map(p => `${p.name}: ${formatMoney(p.total)}`)
    expect(lines.filter(l => personLines.includes(l))).toEqual(personLines)
  })

  // People read any other amount as something to pay on top of their own
  // share, so each person's share is the only amount shown.
  it('shows no amount other than each person\'s share', () => {
    const amounts = renderSummary(sample).match(/\$\d[\d,]*\.\d\d/g) ?? []
    expect(amounts).toEqual(sample.people.map(p => formatMoney(p.total)))
  })

  it('ends with the bill link alone on its own line, after a blank line', () => {
    const link = 'https://example.test/#b=1.abc'
    expect(renderSummary({ ...minimal, link })).toBe(`${renderSummary(minimal)}\n\n${link}`)
    expect(renderSummary({ ...sample, link })).toBe(`${renderSummary(sample)}\n\n${link}`)
  })

  it('uses a generic title for an unnamed bill and leaves out the note when nothing was added', () => {
    expect(renderSummary(minimal)).toBe('Bill split\n\nAlice: $10.00')
  })

  const notes: [string, Partial<SummaryTemplateData['totals']>, string][] = [
    ['tax only', { tax: 1 }, 'Tax is included.'],
    ['tip only', { tip: 1 }, 'Tip is included.'],
    ['a fee only', { fees: [{ name: 'Delivery', amount: 2 }] }, 'Fees are included.'],
    ['a discount only', { fees: [{ name: 'Coupon', amount: -2 }] }, 'Discounts are included.'],
    ['tax and tip', { tax: 1, tip: 2 }, 'Tax and tip are included.'],
    ['tip and a discount', { tip: 2, fees: [{ name: 'Coupon', amount: -2 }] }, 'Tip and discounts are included.'],
    ['tax, tip, and fees', { tax: 1, tip: 2, fees: [{ name: 'Fee', amount: 1 }, { name: 'Delivery', amount: 2 }] }, 'Tax, tip, and fees are included.'],
  ]

  for (const [what, totals, note] of notes) {
    it(`names ${what} in the note, after the shares and before the link`, () => {
      const link = 'https://example.test/#b=1.abc'
      const data = { ...minimal, totals: { ...minimal.totals, ...totals }, link }
      expect(renderSummary(data)).toBe(`Bill split\n\nAlice: $10.00\n\n${note}\n\n${link}`)
    })
  }
})

/**
 * The text a person sees when the rich-text summary is pasted: each line
 * break becomes a newline and entities are decoded. Uses the browser's HTML
 * parser rather than stripping tags with a pattern, so the comparison sees
 * exactly what a real parser would.
 */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const br of Array.from(doc.body.querySelectorAll('br'))) br.replaceWith('\n')
  return doc.body.textContent ?? ''
}

describe('renderSummaryHtml', () => {
  it('renders the sample bill with the title in bold and the note in italics', () => {
    expect(renderSummaryHtml(sample)).toMatchInlineSnapshot(`"<div><b>Dinner at Rosa's</b><br><br>Alice: $46.86<br>Bob: $14.57<br>Chris: $31.68<br><br><i>Tax, tip, fees, and discounts are included.</i></div>"`)
  })

  it('has the same text and line breaks as the plain summary', () => {
    expect(htmlToText(renderSummaryHtml(sample))).toBe(renderSummary(sample))
  })

  it('reads back as the plain summary when names look like markup', () => {
    const data = { ...minimal, name: '<<b>b>Tom & &amp; "Jerry"' }
    expect(htmlToText(renderSummaryHtml(data))).toBe(renderSummary(data))
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
  it('leaves italic text unmarked in plain text', () => {
    expect(renderSummary(minimal, '{{ "Hi" | italic }} there')).toBe('Hi there')
  })

  it('wraps italic text in <i> in the rich text', () => {
    expect(renderSummaryHtml(minimal, '{{ "Hi" | italic }} {{ "there" | bold }}')).toBe('<div><i>Hi</i> <b>there</b></div>')
  })

  it('does not nest styles', () => {
    expect(renderSummaryHtml(minimal, '{{ "Hi" | bold | italic }}')).toBe('<div><i>Hi</i></div>')
  })

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
