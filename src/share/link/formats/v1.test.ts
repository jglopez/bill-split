import { describe, expect, it } from 'vitest'
import { PackedShapeError, unpack } from './v1'

const valid = () => ['Bill', ['A', 'B'], [['Pizza', '10', null], ['Soda', '2', [1], 1]], '8%', '', 0, [['Tip jar', '1', 1]], [0, 0, ['', '']]]

describe('link format 1', () => {
  it('unpacks a valid bill', () => {
    const bill = unpack(valid())
    expect(bill.participants.map(p => p.name)).toEqual(['A', 'B'])
    expect(bill.items[1]).toMatchObject({ name: 'Soda', assignedTo: [bill.participants[1].id], taxable: false })
    expect(bill.additionalFees[0].base).toBe('post-tax')
    expect(bill.singlePayerId).toBe(bill.participants[0].id)
  })

  it.each([
    ['a non-array', () => 'x'],
    ['a missing section', () => valid().slice(0, 7)],
    ['an out-of-range participant', () => { const v = valid(); (v[2] as unknown[][])[1][2] = [5]; return v }],
    ['a fractional participant', () => { const v = valid(); (v[2] as unknown[][])[1][2] = [0.5]; return v }],
    ['a bad taxable flag', () => { const v = valid(); (v[2] as unknown[][])[1][3] = 0; return v }],
    ['tip flags out of range', () => { const v = valid(); v[5] = 8; return v }],
    ['a bad fee base', () => { const v = valid(); (v[6] as unknown[][])[0][2] = 2; return v }],
    ['amounts paid for the wrong number of people', () => { const v = valid(); (v[7] as unknown[])[2] = ['']; return v }],
    ['a payer who is not on the bill', () => { const v = valid(); (v[7] as unknown[])[1] = 2; return v }],
  ])('rejects %s', (_, make) => {
    expect(() => unpack(make())).toThrow(PackedShapeError)
  })
})
