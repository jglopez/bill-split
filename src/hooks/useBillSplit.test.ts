// Pure-function tests for isBillState.
// Run with: npm test

import { isBillState } from './useBillSplit'
import { describe, it, expect } from 'vitest'

const validState = {
  participants: [{ id: 'a', name: 'Alice' }],
  items: [{ id: 'i1', name: 'Tacos', price: '10.00', assignedTo: null }],
  tax: '8%',
  tip: '18%',
  tipBase: 'pre-tax',
  additionalFees: [{ id: 'f1', name: 'Service', amount: '2', base: 'pre-tax' }],
  payerMode: 'single',
  singlePayerId: 'a',
  amountPaid: {},
}

describe('isBillState', () => {
  it('valid fully-populated state returns true', () => {
    expect(isBillState(validState)).toBe(true)
  })

  it('valid state with empty arrays returns true', () => {
    expect(isBillState({ ...validState, participants: [], items: [], additionalFees: [] })).toBe(true)
  })

  it('null returns false', () => {
    expect(!isBillState(null)).toBe(true)
  })

  it('non-object returns false', () => {
    expect(!isBillState('string')).toBe(true)
    expect(!isBillState(42)).toBe(true)
  })

  it('missing top-level field returns false', () => {
    const { tax: _tax, ...noTax } = validState
    expect(!isBillState(noTax)).toBe(true)
  })

  it('items: [null] returns false', () => {
    expect(!isBillState({ ...validState, items: [null] })).toBe(true)
  })

  it('items: [{ garbage: 1 }] returns false', () => {
    expect(!isBillState({ ...validState, items: [{ garbage: 1 }] })).toBe(true)
  })

  it('item with non-string price returns false', () => {
    const badItem = { id: 'i1', name: 'x', price: 10, assignedTo: null }
    expect(!isBillState({ ...validState, items: [badItem] })).toBe(true)
  })

  it('item with string assignedTo returns false', () => {
    const badItem = { id: 'i1', name: 'x', price: '10', assignedTo: 'alice' }
    expect(!isBillState({ ...validState, items: [badItem] })).toBe(true)
  })

  it('item with boolean taxable value is valid', () => {
    const itemWithTaxable = { id: 'i1', name: 'x', price: '10', assignedTo: null, taxable: false }
    expect(isBillState({ ...validState, items: [itemWithTaxable] })).toBe(true)
  })

  it('item with non-boolean taxable returns false', () => {
    const badItem = { id: 'i1', name: 'x', price: '10', assignedTo: null, taxable: 'yes' }
    expect(!isBillState({ ...validState, items: [badItem] })).toBe(true)
  })

  it('participants: [null] returns false', () => {
    expect(!isBillState({ ...validState, participants: [null] })).toBe(true)
  })

  it('participant missing id returns false', () => {
    expect(!isBillState({ ...validState, participants: [{ name: 'Alice' }] })).toBe(true)
  })

  it('additionalFees: [null] returns false', () => {
    expect(!isBillState({ ...validState, additionalFees: [null] })).toBe(true)
  })

  it('fee with invalid base returns false', () => {
    const badFee = { id: 'f1', name: 'x', amount: '2', base: 'with-tax' }
    expect(!isBillState({ ...validState, additionalFees: [badFee] })).toBe(true)
  })

  it('invalid tipBase returns false', () => {
    expect(!isBillState({ ...validState, tipBase: 'with-tax' })).toBe(true)
  })

  it('invalid payerMode returns false', () => {
    expect(!isBillState({ ...validState, payerMode: 'group' })).toBe(true)
  })
})
