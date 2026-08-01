// Pure-function tests for reconcileColumnOrder.
// Run with: npm test

import { reconcileColumnOrder } from './useColumnOrder'
import { describe, it, expect } from 'vitest'

describe('reconcileColumnOrder', () => {
  it('null (no stored order) falls back to insertion order', () => {
    expect(reconcileColumnOrder(null, ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('non-array stored value falls back to insertion order', () => {
    expect(reconcileColumnOrder('garbage', ['a', 'b'])).toEqual(['a', 'b'])
    expect(reconcileColumnOrder({ a: 1 }, ['a', 'b'])).toEqual(['a', 'b'])
    expect(reconcileColumnOrder(42, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('stored custom order is preserved', () => {
    expect(reconcileColumnOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })

  it('duplicate ids in storage are deduplicated', () => {
    expect(reconcileColumnOrder(['a', 'b', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('ids of removed participants are dropped', () => {
    expect(reconcileColumnOrder(['gone', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('new participants are appended at the end', () => {
    expect(reconcileColumnOrder(['b', 'a'], ['a', 'b', 'new'])).toEqual(['b', 'a', 'new'])
  })

  it('drop and append combine with order preserved', () => {
    expect(reconcileColumnOrder(['gone', 'c', 'a'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })

  it('non-string garbage in a stored array is filtered out', () => {
    expect(reconcileColumnOrder([1, null, 'a'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('empty stored array yields insertion order', () => {
    expect(reconcileColumnOrder([], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('no participants yields empty order', () => {
    expect(reconcileColumnOrder(['a', 'b'], [])).toEqual([])
    expect(reconcileColumnOrder(null, [])).toEqual([])
  })
})
