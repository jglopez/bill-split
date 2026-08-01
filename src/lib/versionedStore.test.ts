// Standalone test script for makeVersionedStore.
// Run with: npm test
//
// Tests makeVersionedStore in isolation using an in-memory localStorage mock,
// then fuzz-tests migrateV1toBillV2 with randomized v1 payloads.

import { makeVersionedStore } from './versionedStore'
import { migrateV1toBillV2 } from './billMigrations'
import { describe, it, expect, beforeEach } from 'vitest'

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

describe('makeVersionedStore', () => {
  beforeEach(() => {
    resetStorage()
  })

  it('returns fallback when no keys exist', () => {
    const store = makeVersionedStore('key:v2', [], { x: 0 })
    expect(store.load()).toEqual({ x: 0 })
    expect(localStorage.getItem('key:v2') === null).toBe(true)
  })

  it('returns current key value without running migrations', () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 42 }))
    localStorage.setItem('key:v1', JSON.stringify({ x: 99 })) // should be ignored
    const migrateCalled = { value: false }
    const store = makeVersionedStore<{ x: number }>(
      'key:v2',
      [['key:v1', raw => { migrateCalled.value = true; return raw as { x: number } }]],
      { x: 0 },
    )
    expect(store.load()).toEqual({ x: 42 })
    expect(!migrateCalled.value).toBe(true)
  })

  it('migrates from old key, writes to current, removes old', () => {
    localStorage.setItem('key:v1', JSON.stringify({ x: 1 }))
    const store = makeVersionedStore<{ x: number; migrated: boolean }>(
      'key:v2',
      [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
      { x: 0, migrated: false },
    )
    const result = store.load()
    expect(result).toEqual({ x: 1, migrated: true })
    expect(localStorage.getItem('key:v2') !== null).toBe(true)
    expect(JSON.parse(localStorage.getItem('key:v2')!)).toEqual({ x: 1, migrated: true })
    expect(localStorage.getItem('key:v1') === null).toBe(true)
  })

  it('chained migrations: only the matching old key runs', () => {
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
    expect(result.step).toEqual('v1')
    expect(localStorage.getItem('key:v0') === null).toBe(true)
  })

  it('skips to second migration when first old key is absent', () => {
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
    expect(result.step).toEqual('v0')
    expect(localStorage.getItem('key:v0') === null).toBe(true)
  })

  it('corrupt current key falls back to migration', () => {
    localStorage.setItem('key:v2', 'not-json{{')
    localStorage.setItem('key:v1', JSON.stringify({ x: 7 }))
    const store = makeVersionedStore<{ x: number; migrated: boolean }>(
      'key:v2',
      [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
      { x: 0, migrated: false },
    )
    const result = store.load()
    expect(result).toEqual({ x: 7, migrated: true })
  })

  it('corrupt current key, no valid old key returns fallback', () => {
    localStorage.setItem('key:v2', 'bad-json')
    const store = makeVersionedStore('key:v2', [], { x: -1 })
    expect(store.load()).toEqual({ x: -1 })
  })

  it('save writes to current key', () => {
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
    store.save({ x: 100 })
    expect(JSON.parse(localStorage.getItem('key:v2')!)).toEqual({ x: 100 })
  })

  it('second load after save returns saved value', () => {
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
    store.save({ x: 55 })
    expect(store.load()).toEqual({ x: 55 })
  })

  it('save returns true on success', () => {
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
    const result = store.save({ x: 1 })
    expect(result === true).toBe(true)
  })

  it('save returns false when setItem throws (simulated quota exceeded)', () => {
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 })
    mockStorage.setItem = () => { throw new DOMException('QuotaExceededError') }
    const result = store.save({ x: 99 })
    expect(result === false).toBe(true)
  })

  it('validate: valid current key passes through unchanged', () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 42 }))
    const isValid = (v: unknown): v is { x: number } =>
      typeof (v as Record<string, unknown>).x === 'number'
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: 0 }, isValid)
    expect(store.load()).toEqual({ x: 42 })
  })

  it('validate: invalid-shape current key falls back to fallback', () => {
    localStorage.setItem('key:v2', JSON.stringify({ notX: 'wrong' }))
    const isValid = (v: unknown): v is { x: number } =>
      typeof (v as Record<string, unknown>).x === 'number'
    const store = makeVersionedStore<{ x: number }>('key:v2', [], { x: -1 }, isValid)
    expect(store.load()).toEqual({ x: -1 })
  })

  it('validate: invalid-shape current key falls back to migration when available', () => {
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
    expect(store.load()).toEqual({ x: 7 })
  })

  it('migration succeeds and returns migrated value even when removeItem throws', () => {
    localStorage.setItem('key:v1', JSON.stringify({ x: 7 }))
    // Force removeItem to fail to verify the try/catch guard in versionedStore
    mockStorage.removeItem = () => { throw new Error('simulated removeItem failure') }
    const store = makeVersionedStore<{ x: number; migrated: boolean }>(
      'key:v2',
      [['key:v1', raw => ({ ...(raw as { x: number }), migrated: true })]],
      { x: 0, migrated: false },
    )
    const result = store.load()
    expect(result).toEqual({ x: 7, migrated: true })
  })
})

// ─── migrateV1toBillV2 fuzz tests ─────────────────────────────────────────────

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

describe('migrateV1toBillV2 (fuzz)', () => {
  it('assignedTo is never [] after migration (50 payloads × up to 10 items)', () => {
    for (let i = 0; i < 50; i++) {
      const itemCount = Math.floor(Math.random() * 10) + 1
      const payload = randomV1(itemCount)
      const result = migrateV1toBillV2(payload)

      for (const item of result.items) {
        expect(!(Array.isArray(item.assignedTo) && item.assignedTo.length === 0)).toBe(true)
      }
    }
  })

  it('non-empty arrays and null are preserved exactly (50 payloads)', () => {
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
        expect(result.items[j].assignedTo).toEqual(items[j].assignedTo)
      }
    }
  })

  it('empty items array produces empty items (20 payloads)', () => {
    for (let i = 0; i < 20; i++) {
      const result = migrateV1toBillV2({ items: [] })
      expect(result.items).toEqual([])
    }
  })

  it('missing items field produces empty items array', () => {
    const result = migrateV1toBillV2({ tax: '5.00' })
    expect(result.items).toEqual([])
  })

  it('null payload fields do not crash migration', () => {
    const result = migrateV1toBillV2({ items: undefined, participants: undefined })
    expect(Array.isArray(result.items)).toBe(true)
  })
})

// ─── migrateV1toBillV2 validation tests ──────────────────────────────────────

function assertThrows(fn: () => unknown) {
  let threw = false
  try { fn() } catch { threw = true }
  expect(threw).toBe(true)
}

describe('migrateV1toBillV2 (validation)', () => {
  it('throws when assignedTo is a string', () => {
    assertThrows(
      () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: 'invalid' }] }),
    )
  })

  it('throws when assignedTo is a boolean', () => {
    assertThrows(
      () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: true }] }),
    )
  })

  it('throws when assignedTo is a plain object', () => {
    assertThrows(
      () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: { ids: [] } }] }),
    )
  })

  it('throws when price is a number instead of string', () => {
    assertThrows(
      () => migrateV1toBillV2({ items: [{ id: 'x', name: 'x', price: 9.99, assignedTo: null }] }),
    )
  })
})
