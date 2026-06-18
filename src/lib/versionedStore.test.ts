// Standalone test script for makeVersionedStore.
// Run with: npm test
//
// Tests makeVersionedStore in isolation using an in-memory localStorage mock,
// then fuzz-tests migrateV1toBillV2 with randomized v1 payloads.

import { makeVersionedStore } from './versionedStore'
import { migrateV1toBillV2 } from './billMigrations'
import { test as baseTest, assert, assertEqual, summary } from '../test/harness'

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeMockStorage(): Storage & { _store: Record<string, string> } {
  const _store: Record<string, string> = {}
  return {
    _store,
    getItem: (k: string) => _store[k] ?? null,
    setItem: (k: string, v: string) => { _store[k] = v },
    removeItem: (k: string) => { delete _store[k] },
    clear: () => { for (const k in _store) delete _store[k] },
    get length() { return Object.keys(_store).length },
    key: (i: number) => Object.keys(_store)[i] ?? null,
  }
}

// Inject mock storage globally before tests run.
let mockStorage = makeMockStorage()
Object.defineProperty(globalThis, 'localStorage', {
  get: () => mockStorage,
  configurable: true,
})

function resetStorage() {
  mockStorage = makeMockStorage()
}

// Wrap the shared test() to reset storage before each case.
function test(name: string, fn: () => void) {
  baseTest(name, () => { resetStorage(); fn() })
}

// ─── makeVersionedStore tests ─────────────────────────────────────────────────

console.log('\nmakeVersionedStore')

test('returns fallback when no keys exist', () => {
  const store = makeVersionedStore('key:v2', [], { x: 0 })
  assertEqual(store.load(), { x: 0 }, 'load()')
  assert(localStorage.getItem('key:v2') === null, 'should not write when returning fallback')
})

test('returns current key value without running migrations', () => {
  localStorage.setItem('key:v2', JSON.stringify({ x: 42 }))
  localStorage.setItem('key:v1', JSON.stringify({ x: 99 })) // should be ignored
  const migrateCalled = { value: false }
  const store = makeVersionedStore<{ x: number }>(
    'key:v2',
    [['key:v1', raw => { migrateCalled.value = true; return raw as { x: number } }]],
    { x: 0 },
  )
  assertEqual(store.load(), { x: 42 }, 'load()')
  assert(!migrateCalled.value, 'migrate should not be called when current key exists')
})

test('migrates from old key, writes to current, removes old', () => {
  localStorage.setItem('key:v1', JSON.stringify({ x: 1 }))
  const store = makeVersionedStore<{ x: number; migrated: boolean }>(
    'key:v2',
    [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
    { x: 0, migrated: false },
  )
  const result = store.load()
  assertEqual(result, { x: 1, migrated: true }, 'migrated value')
  assert(localStorage.getItem('key:v2') !== null, 'current key written')
  assertEqual(JSON.parse(localStorage.getItem('key:v2')!), { x: 1, migrated: true }, 'current key content')
  assert(localStorage.getItem('key:v1') === null, 'old key removed')
})

test('chained migrations: only the matching old key runs', () => {
  localStorage.setItem('key:v1', JSON.stringify({ x: 10 }))
  // key:v0 is absent — only v1→v2 should run
  const store = makeVersionedStore<{ x: number; step: string }>(
    'key:v2',
    [
      ['key:v1', raw => ({ ...(raw as { x: number }), step: 'v1' })],
      ['key:v0', raw => ({ ...(raw as { x: number }), step: 'v0' })],
    ],
    { x: 0, step: 'none' },
  )
  const result = store.load()
  assertEqual(result.step, 'v1', 'only v1 migration ran')
  assert(localStorage.getItem('key:v0') === null, 'v0 key untouched (was absent)')
})

test('skips to second migration when first old key is absent', () => {
  localStorage.setItem('key:v0', JSON.stringify({ x: 5 }))
  const store = makeVersionedStore<{ x: number; step: string }>(
    'key:v2',
    [
      ['key:v1', raw => ({ ...(raw as { x: number }), step: 'v1' })],
      ['key:v0', raw => ({ ...(raw as { x: number }), step: 'v0' })],
    ],
    { x: 0, step: 'none' },
  )
  const result = store.load()
  assertEqual(result.step, 'v0', 'v0 migration ran as fallback')
  assert(localStorage.getItem('key:v0') === null, 'v0 key removed')
})

test('corrupt current key falls back to migration', () => {
  localStorage.setItem('key:v2', 'not-json{{')
  localStorage.setItem('key:v1', JSON.stringify({ x: 7 }))
  const store = makeVersionedStore<{ x: number; migrated: boolean }>(
    'key:v2',
    [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
    { x: 0, migrated: false },
  )
  const result = store.load()
  assertEqual(result, { x: 7, migrated: true }, 'migrated from old key')
})

test('corrupt current key, no valid old key returns fallback', () => {
  localStorage.setItem('key:v2', 'bad-json')
  const store = makeVersionedStore('key:v2', [], { x: -1 })
  assertEqual(store.load(), { x: -1 }, 'fallback returned')
})

test('save writes to current key', () => {
  const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
  store.save({ x: 100 })
  assertEqual(JSON.parse(localStorage.getItem('key:v2')!), { x: 100 }, 'saved value')
})

test('second load after save returns saved value', () => {
  const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
  store.save({ x: 55 })
  assertEqual(store.load(), { x: 55 }, 'round-trip')
})

test('validate: valid current key passes through unchanged', () => {
  localStorage.setItem('key:v2', JSON.stringify({ x: 42 }))
  const isValid = (v: unknown): v is { x: number } =>
    typeof (v as Record<string, unknown>).x === 'number'
  const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 }, isValid)
  assertEqual(store.load(), { x: 42 }, 'valid value returned directly')
})

test('validate: invalid-shape current key falls back to fallback', () => {
  localStorage.setItem('key:v2', JSON.stringify({ notX: 'wrong' }))
  const isValid = (v: unknown): v is { x: number } =>
    typeof (v as Record<string, unknown>).x === 'number'
  const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: -1 }, isValid)
  assertEqual(store.load(), { x: -1 }, 'invalid shape falls back to fallback')
})

test('validate: invalid-shape current key falls back to migration when available', () => {
  localStorage.setItem('key:v2', JSON.stringify({ notX: 'wrong' }))
  localStorage.setItem('key:v1', JSON.stringify({ x: 7 }))
  const isValid = (v: unknown): v is { x: number } =>
    typeof (v as Record<string, unknown>).x === 'number'
  const store = makeVersionedStore<{ x: number }>(
    'key:v2',
    [['key:v1', raw => raw as { x: number }]],
    { x: -1 },
    isValid,
  )
  assertEqual(store.load(), { x: 7 }, 'migrated value returned when current key fails validation')
})

test('migration succeeds and returns migrated value even when removeItem throws', () => {
  localStorage.setItem('key:v1', JSON.stringify({ x: 7 }))
  // Force removeItem to fail to verify the try/catch guard in versionedStore
  mockStorage.removeItem = () => { throw new Error('simulated removeItem failure') }
  const store = makeVersionedStore<{ x: number; migrated: boolean }>(
    'key:v2',
    [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
    { x: 0, migrated: false },
  )
  const result = store.load()
  assertEqual(result, { x: 7, migrated: true }, 'migrated value returned despite removeItem failure')
})

// ─── migrateV1toBillV2 fuzz tests ─────────────────────────────────────────────

console.log('\nmigrateV1toBillV2 (fuzz)')

type V1Item = { id: string; name: string; price: string; assignedTo: string[] | null }

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function randomAssignedTo(): string[] | null {
  const r = Math.random()
  if (r < 0.25) return []           // v1 "all" sentinel — should become null
  if (r < 0.50) return null         // already null — should stay null
  if (r < 0.75) return [randomId()] // subset — should be preserved
  return [randomId(), randomId()]   // multi-person subset
}

function randomItem(): V1Item {
  return { id: randomId(), name: 'item', price: String(Math.random() * 100), assignedTo: randomAssignedTo() }
}

function randomV1(itemCount: number): { items: V1Item[]; participants: unknown[]; tax: string; tip: string } {
  return {
    items: Array.from({ length: itemCount }, randomItem),
    participants: [],
    tax: '',
    tip: '',
  }
}

test('fuzz: assignedTo is never [] after migration (50 payloads × up to 10 items)', () => {
  for (let i = 0; i < 50; i++) {
    const itemCount = Math.floor(Math.random() * 10) + 1
    const payload = randomV1(itemCount)
    const result = migrateV1toBillV2(payload)

    for (const item of result.items) {
      assert(
        !(Array.isArray(item.assignedTo) && item.assignedTo.length === 0),
        `item ${item.id} has assignedTo: [] after migration (payload index ${i})`,
      )
    }
  }
})

test('fuzz: non-empty arrays and null are preserved exactly (50 payloads)', () => {
  for (let i = 0; i < 50; i++) {
    const itemCount = Math.floor(Math.random() * 8) + 1
    // Force only non-empty-array assignedTo values
    const items: V1Item[] = Array.from({ length: itemCount }, () => ({
      id: randomId(),
      name: 'x',
      price: '1.00',
      assignedTo: Math.random() < 0.5 ? null : [randomId()],
    }))
    const payload = { items }
    const result = migrateV1toBillV2(payload)

    for (let j = 0; j < items.length; j++) {
      assertEqual(
        result.items[j].assignedTo,
        items[j].assignedTo,
        `item[${j}] assignedTo preserved (payload index ${i})`,
      )
    }
  }
})

test('fuzz: empty items array produces empty items (20 payloads)', () => {
  for (let i = 0; i < 20; i++) {
    const result = migrateV1toBillV2({ items: [] })
    assertEqual(result.items, [], `empty items (payload index ${i})`)
  }
})

test('fuzz: missing items field produces empty items array', () => {
  const result = migrateV1toBillV2({ tax: '5.00' })
  assertEqual(result.items, [], 'items defaults to []')
})

test('fuzz: null payload fields do not crash migration', () => {
  const result = migrateV1toBillV2({ items: undefined, participants: undefined })
  assert(Array.isArray(result.items), 'items is array even when input items is undefined')
})

// ─── migrateV1toBillV2 validation tests ──────────────────────────────────────

console.log('\nmigrateV1toBillV2 (validation)')

function assertThrows(fn: () => unknown, label: string) {
  let threw = false
  try { fn() } catch { threw = true }
  assert(threw, label)
}

test('throws when assignedTo is a string', () => {
  assertThrows(
    () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: 'invalid' }] }),
    'should throw for string assignedTo',
  )
})

test('throws when assignedTo is a boolean', () => {
  assertThrows(
    () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: true }] }),
    'should throw for boolean assignedTo',
  )
})

test('throws when assignedTo is a plain object', () => {
  assertThrows(
    () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: { ids: [] } }] }),
    'should throw for object assignedTo',
  )
})

test('throws when price is a number instead of string', () => {
  assertThrows(
    () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: 9.99, assignedTo: null }] }),
    'should throw for numeric price',
  )
})

// ─── Summary ──────────────────────────────────────────────────────────────────

summary()
