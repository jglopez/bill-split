// Standalone test script for format utilities.
// Run with: npm test

import { formatAmount, formatMoney } from './format'
import { describe, it, expect } from 'vitest'

describe('formatAmount', () => {
  it('positive number, no $ prefix', () => {
    expect(formatAmount(5)).toEqual('5.00')
  })
  it('zero', () => {
    expect(formatAmount(0)).toEqual('0.00')
  })
  it('negative uses U+2212 minus (not ASCII hyphen)', () => {
    expect(formatAmount(-5)).toEqual('−5.00')
  })
  it('negative: sign precedes digits, no $', () => {
    // U+2212 is the Unicode minus sign
    const result = formatAmount(-3.50)
    expect(result).toEqual('−3.50')
  })
  it('rounding to 2 decimal places', () => {
    expect(formatAmount(1.005)).toEqual('1.00')
  })
})

describe('formatMoney', () => {
  it('positive number with $ prefix', () => {
    expect(formatMoney(5)).toEqual('$5.00')
  })
  it('zero', () => {
    expect(formatMoney(0)).toEqual('$0.00')
  })
  it('negative: Unicode minus precedes $, not after', () => {
    // Should be −$5.00, not $-5.00
    expect(formatMoney(-5)).toEqual('−$5.00')
  })
  it('negative large amount', () => {
    expect(formatMoney(-100)).toEqual('−$100.00')
  })
  it('rounding to 2 decimal places', () => {
    expect(formatMoney(1.005)).toEqual('$1.00')
  })
})
