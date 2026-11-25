import { describe, expect, it } from 'vitest'
import { BILL_HASH_PREFIX, PERSON_PARAM, splitBillHash, withPerson } from './hash'

const bill = `${BILL_HASH_PREFIX}1.abc_-`

describe('person markers in bill links', () => {
  it('reads no person from a plain bill link', () => {
    expect(splitBillHash(bill)).toEqual({ bill, person: null })
  })

  it('reads the person and strips the marker from the bill', () => {
    expect(splitBillHash(`${bill}${PERSON_PARAM}3`)).toEqual({ bill, person: 3 })
  })

  it.each(['', '-1', '1.5', 'x', '00001'])('treats the marker %j as no person', value => {
    expect(splitBillHash(`${bill}${PERSON_PARAM}${value}`)).toEqual({ bill, person: null })
  })

  it('adds a marker, replacing any earlier one', () => {
    expect(withPerson(bill, 0)).toBe(`${bill}${PERSON_PARAM}0`)
    expect(withPerson(withPerson(bill, 4), 2)).toBe(`${bill}${PERSON_PARAM}2`)
  })

  it('refuses a position that is not a whole number from zero up', () => {
    expect(() => withPerson(bill, -1)).toThrow(RangeError)
    expect(() => withPerson(bill, 1.5)).toThrow(RangeError)
  })

  it('keeps the bill data in characters that need no escaping', () => {
    expect(withPerson(bill, 12)).toMatch(/^#b=\d+\.[A-Za-z0-9_-]+&p=\d+$/)
  })
})
