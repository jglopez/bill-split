// Pure-function tests for reconcileColumnOrder.
// Run with: npm test

import { reconcileColumnOrder, useColumnOrder } from './useColumnOrder'
import type { Participant } from '../types'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const COLUMN_ORDER_KEY = 'bill-split-column-order:v1'

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

describe('useColumnOrder', () => {
  const a: Participant = { id: 'a', name: 'Alice' }
  const b: Participant = { id: 'b', name: 'Bob' }
  const c: Participant = { id: 'c', name: 'Carol' }

  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds insertion order when nothing is stored', () => {
    const { result } = renderHook(() => useColumnOrder([a, b]))
    expect(result.current.columnOrder).toEqual(['a', 'b'])
    expect(result.current.orderedParticipants).toEqual([a, b])
  })

  it('seeds from a stored order, reconciled against current participants', () => {
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(['b', 'a']))
    const { result } = renderHook(() => useColumnOrder([a, b]))
    expect(result.current.columnOrder).toEqual(['b', 'a'])
    expect(result.current.orderedParticipants).toEqual([b, a])
  })

  it('appends a newly added participant when participants change', () => {
    const { result, rerender } = renderHook(
      ({ participants }) => useColumnOrder(participants),
      { initialProps: { participants: [a, b] } },
    )
    expect(result.current.columnOrder).toEqual(['a', 'b'])

    rerender({ participants: [a, b, c] })
    expect(result.current.columnOrder).toEqual(['a', 'b', 'c'])
  })

  it('drops a removed participant when participants change', () => {
    const { result, rerender } = renderHook(
      ({ participants }) => useColumnOrder(participants),
      { initialProps: { participants: [a, b, c] } },
    )
    rerender({ participants: [a, c] })
    expect(result.current.columnOrder).toEqual(['a', 'c'])
    expect(result.current.orderedParticipants).toEqual([a, c])
  })

  it('setColumnOrder persists the new order to localStorage', () => {
    const { result } = renderHook(() => useColumnOrder([a, b]))
    act(() => {
      result.current.setColumnOrder(['b', 'a'])
    })
    expect(result.current.columnOrder).toEqual(['b', 'a'])
    expect(JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY)!)).toEqual(['b', 'a'])
  })
})
