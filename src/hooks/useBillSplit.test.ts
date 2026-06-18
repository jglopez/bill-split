// Pure-function tests for isBillState.
// Run with: npm test

import { isBillState } from './useBillSplit'
import { test, assert, summary } from '../test/harness'

console.log('\nisBillState')

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

test('valid fully-populated state returns true', () => {
  assert(isBillState(validState), 'valid state accepted')
})

test('valid state with empty arrays returns true', () => {
  assert(isBillState({ ...validState, participants: [], items: [], additionalFees: [] }), 'empty arrays ok')
})

test('null returns false', () => {
  assert(!isBillState(null), 'null rejected')
})

test('non-object returns false', () => {
  assert(!isBillState('string'), 'string rejected')
  assert(!isBillState(42), 'number rejected')
})

test('missing top-level field returns false', () => {
  const { tax: _tax, ...noTax } = validState
  assert(!isBillState(noTax), 'missing tax rejected')
})

test('items: [null] returns false', () => {
  assert(!isBillState({ ...validState, items: [null] }), 'null item rejected')
})

test('items: [{ garbage: 1 }] returns false', () => {
  assert(!isBillState({ ...validState, items: [{ garbage: 1 }] }), 'garbage item rejected')
})

test('item with non-string price returns false', () => {
  const badItem = { id: 'i1', name: 'x', price: 10, assignedTo: null }
  assert(!isBillState({ ...validState, items: [badItem] }), 'numeric price rejected')
})

test('item with string assignedTo returns false', () => {
  const badItem = { id: 'i1', name: 'x', price: '10', assignedTo: 'alice' }
  assert(!isBillState({ ...validState, items: [badItem] }), 'string assignedTo rejected')
})

test('item with boolean taxable value is valid', () => {
  const itemWithTaxable = { id: 'i1', name: 'x', price: '10', assignedTo: null, taxable: false }
  assert(isBillState({ ...validState, items: [itemWithTaxable] }), 'boolean taxable accepted')
})

test('item with non-boolean taxable returns false', () => {
  const badItem = { id: 'i1', name: 'x', price: '10', assignedTo: null, taxable: 'yes' }
  assert(!isBillState({ ...validState, items: [badItem] }), 'string taxable rejected')
})

test('participants: [null] returns false', () => {
  assert(!isBillState({ ...validState, participants: [null] }), 'null participant rejected')
})

test('participant missing id returns false', () => {
  assert(!isBillState({ ...validState, participants: [{ name: 'Alice' }] }), 'participant without id rejected')
})

test('additionalFees: [null] returns false', () => {
  assert(!isBillState({ ...validState, additionalFees: [null] }), 'null fee rejected')
})

test('fee with invalid base returns false', () => {
  const badFee = { id: 'f1', name: 'x', amount: '2', base: 'with-tax' }
  assert(!isBillState({ ...validState, additionalFees: [badFee] }), 'invalid fee base rejected')
})

test('invalid tipBase returns false', () => {
  assert(!isBillState({ ...validState, tipBase: 'with-tax' }), 'invalid tipBase rejected')
})

test('invalid payerMode returns false', () => {
  assert(!isBillState({ ...validState, payerMode: 'group' }), 'invalid payerMode rejected')
})

summary()
