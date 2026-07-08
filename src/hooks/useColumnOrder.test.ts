// Pure-function tests for reconcileColumnOrder.
// Run with: npm test

import { reconcileColumnOrder } from './useColumnOrder'
import { test, assertEqual, summary } from '../test/harness'

console.log('\nreconcileColumnOrder')

test('null (no stored order) falls back to insertion order', () => {
  assertEqual(reconcileColumnOrder(null, ['a', 'b', 'c']), ['a', 'b', 'c'], 'insertion order')
})

test('non-array stored value falls back to insertion order', () => {
  assertEqual(reconcileColumnOrder('garbage', ['a', 'b']), ['a', 'b'], 'string rejected')
  assertEqual(reconcileColumnOrder({ a: 1 }, ['a', 'b']), ['a', 'b'], 'object rejected')
  assertEqual(reconcileColumnOrder(42, ['a', 'b']), ['a', 'b'], 'number rejected')
})

test('stored custom order is preserved', () => {
  assertEqual(reconcileColumnOrder(['c', 'a', 'b'], ['a', 'b', 'c']), ['c', 'a', 'b'], 'custom order kept')
})

test('duplicate ids in storage are deduplicated', () => {
  assertEqual(reconcileColumnOrder(['a', 'b', 'a', 'b'], ['a', 'b']), ['a', 'b'], 'no duplicate columns')
})

test('ids of removed participants are dropped', () => {
  assertEqual(reconcileColumnOrder(['gone', 'a', 'b'], ['a', 'b']), ['a', 'b'], 'stale id dropped')
})

test('new participants are appended at the end', () => {
  assertEqual(reconcileColumnOrder(['b', 'a'], ['a', 'b', 'new']), ['b', 'a', 'new'], 'new id appended')
})

test('drop and append combine with order preserved', () => {
  assertEqual(
    reconcileColumnOrder(['gone', 'c', 'a'], ['a', 'b', 'c']),
    ['c', 'a', 'b'],
    'stale dropped, order kept, new appended'
  )
})

test('non-string garbage in a stored array is filtered out', () => {
  assertEqual(reconcileColumnOrder([1, null, 'a'], ['a', 'b']), ['a', 'b'], 'garbage entries dropped')
})

test('empty stored array yields insertion order', () => {
  assertEqual(reconcileColumnOrder([], ['a', 'b']), ['a', 'b'], 'all appended')
})

test('no participants yields empty order', () => {
  assertEqual(reconcileColumnOrder(['a', 'b'], []), [], 'empty result')
  assertEqual(reconcileColumnOrder(null, []), [], 'empty fallback')
})

summary()
