import { describe, it, expect, beforeEach } from 'vitest'
import { applyColumnOrder, adoptLegacyColumnOrder, clearLegacyColumnOrder, LEGACY_COLUMN_ORDER_KEY } from './legacyColumnOrder'
import { DEFAULT_STATE } from '../hooks/useBillSplit'
import type { BillState } from '../types'

const bill = (...ids: string[]): BillState => ({
  ...DEFAULT_STATE,
  participants: ids.map(id => ({ id, name: id.toUpperCase() })),
})
const ids = (state: BillState) => state.participants.map(p => p.id)

describe('applyColumnOrder', () => {
  it('leaves the bill unchanged when nothing is stored', () => {
    const state = bill('a', 'b', 'c')
    expect(applyColumnOrder(state, null)).toBe(state)
  })

  it('leaves the bill unchanged when the stored value is not an array', () => {
    const state = bill('a', 'b')
    expect(applyColumnOrder(state, 'garbage')).toBe(state)
    expect(applyColumnOrder(state, { a: 1 })).toBe(state)
    expect(applyColumnOrder(state, 42)).toBe(state)
  })

  it('returns the same bill when the stored order already matches', () => {
    const state = bill('a', 'b')
    expect(applyColumnOrder(state, ['a', 'b'])).toBe(state)
  })

  it('puts participants in the stored order', () => {
    expect(ids(applyColumnOrder(bill('a', 'b', 'c'), ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
  })

  it('keeps each participant once when the stored order has duplicates', () => {
    expect(ids(applyColumnOrder(bill('a', 'b'), ['b', 'a', 'b', 'a']))).toEqual(['b', 'a'])
  })

  it('ignores ids the bill does not have', () => {
    expect(ids(applyColumnOrder(bill('a', 'b'), ['gone', 'b', 'a']))).toEqual(['b', 'a'])
  })

  it('keeps participants the stored order leaves out, after the listed ones', () => {
    expect(ids(applyColumnOrder(bill('a', 'b', 'c'), ['c', 'a']))).toEqual(['c', 'a', 'b'])
  })

  it('ignores entries that are not strings', () => {
    expect(ids(applyColumnOrder(bill('a', 'b'), [1, null, 'b']))).toEqual(['b', 'a'])
  })

  it('keeps the participant objects themselves', () => {
    const state = bill('a', 'b')
    const next = applyColumnOrder(state, ['b', 'a'])
    expect(next.participants).toEqual([state.participants[1], state.participants[0]])
  })
})

describe('adoptLegacyColumnOrder and clearLegacyColumnOrder', () => {
  beforeEach(() => localStorage.clear())

  it('reads the order an older build stored', () => {
    localStorage.setItem(LEGACY_COLUMN_ORDER_KEY, JSON.stringify(['b', 'a']))
    expect(ids(adoptLegacyColumnOrder(bill('a', 'b')))).toEqual(['b', 'a'])
  })

  it('leaves the bill unchanged when the stored value is corrupt', () => {
    localStorage.setItem(LEGACY_COLUMN_ORDER_KEY, '{not json')
    const state = bill('a', 'b')
    expect(adoptLegacyColumnOrder(state)).toBe(state)
  })

  it('removes the old key', () => {
    localStorage.setItem(LEGACY_COLUMN_ORDER_KEY, JSON.stringify(['b', 'a']))
    clearLegacyColumnOrder()
    expect(localStorage.getItem(LEGACY_COLUMN_ORDER_KEY)).toBeNull()
  })
})
