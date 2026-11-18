// Tests for the v2 → v3 schema step.

import { describe, it, expect } from 'vitest'
import { migrate } from './v2'
import v2Fixture from './fixtures/v2.json'

// A v2 bill saved before the tip-base options existed.
const { tipDiscountBase: _d, tipFeeBase: _f, ...v2WithoutTipBases } = v2Fixture

describe('v2 → v3', () => {
  it('fills in missing tip bases with the defaults', () => {
    expect(migrate(v2WithoutTipBases)).toEqual({
      ...v2WithoutTipBases,
      tipDiscountBase: 'pre-discount',
      tipFeeBase: 'pre-fee',
    })
  })

  it('fills in each tip base independently', () => {
    expect(migrate({ ...v2WithoutTipBases, tipFeeBase: 'post-fee' })).toMatchObject({
      tipDiscountBase: 'pre-discount',
      tipFeeBase: 'post-fee',
    })
    expect(migrate({ ...v2WithoutTipBases, tipDiscountBase: 'post-discount' })).toMatchObject({
      tipDiscountBase: 'post-discount',
      tipFeeBase: 'pre-fee',
    })
  })

  it('keeps tip bases that were already chosen', () => {
    expect(migrate(v2Fixture)).toEqual(v2Fixture)
  })

  it('passes invalid values through for validation to reject', () => {
    expect(migrate({ ...v2Fixture, tipFeeBase: 42 })).toMatchObject({ tipFeeBase: 42 })
  })

  it.each([null, 'bill', 7, []])('throws on a non-object payload (%s)', payload => {
    expect(() => migrate(payload)).toThrow('Invalid v2 bill state')
  })
})
