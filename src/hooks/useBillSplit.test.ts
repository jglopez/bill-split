// Pure-function tests for isBillState and the useBillSplit reducer.
// Run with: npm test

import { isBillState, reducer, DEFAULT_STATE } from './useBillSplit'
import type { BillState } from '../types'
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

describe('reducer', () => {
  const p1 = { id: 'p1', name: 'Alice' }
  const p2 = { id: 'p2', name: 'Bob' }

  function baseState(overrides: Partial<BillState> = {}): BillState {
    return { ...DEFAULT_STATE, ...overrides }
  }

  it('RESET returns DEFAULT_STATE', () => {
    const state = baseState({ tax: '10%', participants: [p1] })
    expect(reducer(state, { type: 'RESET' })).toEqual(DEFAULT_STATE)
  })

  it('ADD_PARTICIPANT appends a participant and auto-assigns singlePayerId when unset', () => {
    const state = baseState({ items: [{ id: 'i1', name: 'Taco', price: '5', assignedTo: null }] })
    const next = reducer(state, { type: 'ADD_PARTICIPANT', name: 'Alice' })
    expect(next.participants.length).toEqual(1)
    expect(next.participants[0].name).toEqual('Alice')
    expect(next.singlePayerId).toEqual(next.participants[0].id)
    // ensureTrailingBlankRow: the non-blank 'i1' row gets a fresh blank row appended
    expect(next.items.length).toEqual(2)
    expect(next.items[1].name).toEqual('')
    expect(next.items[1].price).toEqual('')
  })

  it('ADD_PARTICIPANT keeps the existing singlePayerId when already set', () => {
    const state = baseState({ participants: [p1], singlePayerId: 'p1' })
    const next = reducer(state, { type: 'ADD_PARTICIPANT', name: 'Bob' })
    expect(next.singlePayerId).toEqual('p1')
  })

  it('REMOVE_PARTICIPANT drops the participant, clears their assignments and paid amount, and falls back singlePayerId', () => {
    const state = baseState({
      participants: [p1, p2],
      items: [{ id: 'i1', name: 'Taco', price: '5', assignedTo: ['p1', 'p2'] }],
      amountPaid: { p1: '5', p2: '5' },
      singlePayerId: 'p1',
    })
    const next = reducer(state, { type: 'REMOVE_PARTICIPANT', id: 'p1' })
    expect(next.participants).toEqual([p2])
    expect(next.items[0].assignedTo).toEqual(['p2'])
    expect(next.amountPaid).toEqual({ p2: '5' })
    expect(next.singlePayerId).toEqual('p2')
  })

  it('REMOVE_PARTICIPANT falls back to an empty singlePayerId when no participants remain', () => {
    const state = baseState({ participants: [p1], singlePayerId: 'p1' })
    const next = reducer(state, { type: 'REMOVE_PARTICIPANT', id: 'p1' })
    expect(next.singlePayerId).toEqual('')
  })

  it('REMOVE_PARTICIPANT leaves assignedTo: null (all participants) items untouched', () => {
    const state = baseState({
      participants: [p1],
      items: [{ id: 'i1', name: 'Taco', price: '5', assignedTo: null }],
    })
    const next = reducer(state, { type: 'REMOVE_PARTICIPANT', id: 'p1' })
    expect(next.items[0].assignedTo).toEqual(null)
  })

  it('RENAME_PARTICIPANT updates only the matching participant', () => {
    const state = baseState({ participants: [p1, p2] })
    const next = reducer(state, { type: 'RENAME_PARTICIPANT', id: 'p1', name: 'Alicia' })
    expect(next.participants).toEqual([{ id: 'p1', name: 'Alicia' }, p2])
  })

  it('UPDATE_ITEM replaces an existing item by id', () => {
    const state = baseState({ items: [{ id: 'i1', name: 'Taco', price: '5', assignedTo: null }] })
    const updated = { id: 'i1', name: 'Burrito', price: '8', assignedTo: null }
    const next = reducer(state, { type: 'UPDATE_ITEM', item: updated })
    expect(next.items[0]).toEqual(updated)
  })

  it('UPDATE_ITEM appends when the item id is new', () => {
    const state = baseState({ items: [] })
    const newItem = { id: 'i2', name: 'Soda', price: '2', assignedTo: null }
    const next = reducer(state, { type: 'UPDATE_ITEM', item: newItem })
    expect(next.items[0]).toEqual(newItem)
  })

  it('UPDATE_ITEM ensures a trailing blank row', () => {
    const state = baseState({ items: [] })
    const next = reducer(state, {
      type: 'UPDATE_ITEM',
      item: { id: 'i1', name: 'Taco', price: '5', assignedTo: null },
    })
    expect(next.items.length).toEqual(2)
    expect(next.items[1].name).toEqual('')
    expect(next.items[1].price).toEqual('')
  })

  it('REMOVE_ITEM removes the item and appends a trailing blank row', () => {
    const state = baseState({
      items: [
        { id: 'i1', name: 'Taco', price: '5', assignedTo: null },
        { id: 'i2', name: 'Soda', price: '2', assignedTo: null },
      ],
    })
    const next = reducer(state, { type: 'REMOVE_ITEM', id: 'i1' })
    expect(next.items.length).toEqual(2)
    expect(next.items[0].id).toEqual('i2')
    expect(next.items[1].name).toEqual('')
  })

  it('REMOVE_ITEM does not add another blank row when one already trails', () => {
    const state = baseState({
      items: [
        { id: 'i1', name: 'Taco', price: '5', assignedTo: null },
        { id: 'i2', name: 'Soda', price: '2', assignedTo: null },
        { id: 'i3', name: '', price: '', assignedTo: null },
      ],
    })
    const next = reducer(state, { type: 'REMOVE_ITEM', id: 'i2' })
    expect(next.items).toEqual([
      { id: 'i1', name: 'Taco', price: '5', assignedTo: null },
      { id: 'i3', name: '', price: '', assignedTo: null },
    ])
  })

  it('SET_TAX sets the tax value', () => {
    const next = reducer(baseState(), { type: 'SET_TAX', value: '8%' })
    expect(next.tax).toEqual('8%')
  })

  it('SET_TIP sets the tip value', () => {
    const next = reducer(baseState(), { type: 'SET_TIP', value: '18%' })
    expect(next.tip).toEqual('18%')
  })

  it('SET_TIP_BASE sets the tip base', () => {
    const next = reducer(baseState(), { type: 'SET_TIP_BASE', base: 'post-tax' })
    expect(next.tipBase).toEqual('post-tax')
  })

  it('SET_TIP_DISCOUNT_BASE sets the tip discount base', () => {
    const next = reducer(baseState(), { type: 'SET_TIP_DISCOUNT_BASE', base: 'post-discount' })
    expect(next.tipDiscountBase).toEqual('post-discount')
  })

  it('SET_TIP_FEE_BASE sets the tip fee base', () => {
    const next = reducer(baseState(), { type: 'SET_TIP_FEE_BASE', base: 'post-fee' })
    expect(next.tipFeeBase).toEqual('post-fee')
  })

  it('ADD_FEE appends a blank fee with a pre-tax base', () => {
    const next = reducer(baseState({ additionalFees: [] }), { type: 'ADD_FEE' })
    expect(next.additionalFees.length).toEqual(1)
    expect(next.additionalFees[0].name).toEqual('')
    expect(next.additionalFees[0].amount).toEqual('')
    expect(next.additionalFees[0].base).toEqual('pre-tax')
  })

  it('UPDATE_FEE replaces the matching fee', () => {
    const fee1 = { id: 'f1', name: 'Service', amount: '2', base: 'pre-tax' as const }
    const updated = { ...fee1, amount: '3' }
    const next = reducer(baseState({ additionalFees: [fee1] }), { type: 'UPDATE_FEE', fee: updated })
    expect(next.additionalFees).toEqual([updated])
  })

  it('REMOVE_FEE removes the matching fee', () => {
    const fee1 = { id: 'f1', name: 'Service', amount: '2', base: 'pre-tax' as const }
    const next = reducer(baseState({ additionalFees: [fee1] }), { type: 'REMOVE_FEE', id: 'f1' })
    expect(next.additionalFees).toEqual([])
  })

  it('SET_PAYER_MODE sets the payer mode', () => {
    const next = reducer(baseState(), { type: 'SET_PAYER_MODE', mode: 'multiple' })
    expect(next.payerMode).toEqual('multiple')
  })

  it('SET_SINGLE_PAYER sets the single payer id', () => {
    const next = reducer(baseState({ participants: [p1] }), { type: 'SET_SINGLE_PAYER', id: 'p1' })
    expect(next.singlePayerId).toEqual('p1')
  })

  it('SET_AMOUNT_PAID sets one participant\'s paid amount without touching others', () => {
    const state = baseState({ participants: [p1, p2], amountPaid: { p2: '5' } })
    const next = reducer(state, { type: 'SET_AMOUNT_PAID', participantId: 'p1', value: '10' })
    expect(next.amountPaid).toEqual({ p1: '10', p2: '5' })
  })

  it('REORDER_ITEMS moves an item from one index to another', () => {
    const state = baseState({
      items: [
        { id: 'i1', name: 'A', price: '1', assignedTo: null },
        { id: 'i2', name: 'B', price: '2', assignedTo: null },
        { id: 'i3', name: 'C', price: '3', assignedTo: null },
      ],
    })
    const next = reducer(state, { type: 'REORDER_ITEMS', fromIndex: 0, toIndex: 2 })
    // ensureTrailingBlankRow appends a fresh blank row since the new last item ('i1') isn't blank
    expect(next.items.map(i => i.id).slice(0, 3)).toEqual(['i2', 'i3', 'i1'])
    expect(next.items[3].name).toEqual('')
    expect(next.items[3].price).toEqual('')
  })
})
