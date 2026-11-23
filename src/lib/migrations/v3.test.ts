// Tests for the v3 → v4 schema step.

import { describe, it, expect } from 'vitest'
import { migrate } from './v3'
import v3Fixture from './fixtures/v3.json'

describe('v3 → v4', () => {
  it('gives an older bill an empty name', () => {
    expect(migrate(v3Fixture)).toEqual({ ...v3Fixture, name: '' })
  })

  it('keeps a name that is already set', () => {
    expect(migrate({ ...v3Fixture, name: 'Dinner' })).toMatchObject({ name: 'Dinner' })
  })

  it('passes an invalid name through for validation to reject', () => {
    expect(migrate({ ...v3Fixture, name: 42 })).toMatchObject({ name: 42 })
  })

  it.each([null, 'bill', 7, []])('throws on a non-object payload (%s)', payload => {
    expect(() => migrate(payload)).toThrow('Invalid v3 bill state')
  })
})
