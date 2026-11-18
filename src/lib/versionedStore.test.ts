// Standalone test script for makeVersionedStore.
// Run with: npm test
//
// Tests makeVersionedStore in isolation using an in-memory localStorage mock.

import { makeVersionedStore } from './versionedStore'
import { MigrationLoadError } from './migrations'
import { describe, it, expect, beforeEach, vi } from 'vitest'

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

type Upgrade = (raw: unknown, fromVersion: number) => Promise<unknown>

// An upgrade that tags the payload with the version it came from.
const tagVersion: Upgrade = (raw, fromVersion) =>
  Promise.resolve({ ...(raw as object), from: fromVersion })

const isX = (v: unknown) => typeof (v as Record<string, unknown>).x === 'number'

describe('makeVersionedStore', () => {
  beforeEach(() => {
    resetStorage()
  })

  it('returns fallback when no keys exist', async () => {
    const store = makeVersionedStore('key:v3', [], { x: 0 })
    await store.migrate()
    expect(store.load()).toEqual({ x: 0 })
    expect(localStorage.getItem('key:v3')).toBeNull()
  })

  it('does not upgrade when the current key is valid', async () => {
    localStorage.setItem('key:v3', JSON.stringify({ x: 42 }))
    localStorage.setItem('key:v2', JSON.stringify({ x: 99 })) // should be ignored
    const upgrade = vi.fn(tagVersion)
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: 0 }, isX, upgrade)
    await store.migrate()
    expect(store.load()).toEqual({ x: 42 })
    expect(upgrade).not.toHaveBeenCalled()
  })

  it('upgrades a legacy key, writes the current key, removes the legacy key', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 1 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 1, from: 2 })
    expect(JSON.parse(localStorage.getItem('key:v3')!)).toEqual({ x: 1, from: 2 })
    expect(localStorage.getItem('key:v2')).toBeNull()
  })

  it('uses the most recent legacy key and passes its version', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 10 }))
    localStorage.setItem('key:v1', JSON.stringify({ x: 5 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2], ['key:v1', 1]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 10, from: 2 })
  })

  it('falls through to an older legacy key when newer ones are absent', async () => {
    localStorage.setItem('key:v1', JSON.stringify({ x: 5 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2], ['key:v1', 1]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 5, from: 1 })
    expect(localStorage.getItem('key:v1')).toBeNull()
  })

  it('upgrades when the current key is corrupt', async () => {
    localStorage.setItem('key:v3', 'not-json{{')
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 7, from: 2 })
  })

  it('upgrades when the current key fails validation', async () => {
    localStorage.setItem('key:v3', JSON.stringify({ notX: 'wrong' }))
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: -1 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 7, from: 2 })
  })

  it('keeps the legacy key and returns fallback when the upgrade throws', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: -1 }, isX, () =>
      Promise.reject(new Error('invalid legacy data')))
    await store.migrate()
    expect(store.load()).toEqual({ x: -1 })
    expect(localStorage.getItem('key:v2')).not.toBeNull()
  })

  it('tries the next legacy key when an upgrade throws', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 2 }))
    localStorage.setItem('key:v1', JSON.stringify({ x: 1 }))
    const upgrade: Upgrade = (raw, v) => v === 2 ? Promise.reject(new Error('bad')) : tagVersion(raw, v)
    const store = makeVersionedStore('key:v3', [['key:v2', 2], ['key:v1', 1]], { x: 0 }, isX, upgrade)
    await store.migrate()
    expect(store.load()).toEqual({ x: 1, from: 1 })
  })

  it('keeps the legacy key when the upgraded value fails validation', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 'not a number' }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: -1 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: -1 })
    expect(localStorage.getItem('key:v3')).toBeNull()
    expect(localStorage.getItem('key:v2')).not.toBeNull()
  })

  it('rejects with MigrationLoadError and writes nothing when upgrade code fails to load', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: -1 }, isX, () =>
      Promise.reject(new MigrationLoadError(2, new TypeError('Failed to fetch'))))
    await expect(store.migrate()).rejects.toBeInstanceOf(MigrationLoadError)
    expect(localStorage.getItem('key:v3')).toBeNull()
    expect(localStorage.getItem('key:v2')).not.toBeNull()
  })

  it('returns the upgraded value for this session when it cannot be written', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    mockStorage.setItem = () => { throw new DOMException('QuotaExceededError') }
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 7, from: 2 })
    expect(localStorage.getItem('key:v2')).not.toBeNull()
  })

  it('upgrade succeeds even when removing the legacy key throws', async () => {
    localStorage.setItem('key:v2', JSON.stringify({ x: 7 }))
    mockStorage.removeItem = () => { throw new Error('simulated removeItem failure') }
    const store = makeVersionedStore('key:v3', [['key:v2', 2]], { x: 0 }, isX, tagVersion)
    await store.migrate()
    expect(store.load()).toEqual({ x: 7, from: 2 })
  })

  it('corrupt current key with no legacy data returns fallback', () => {
    localStorage.setItem('key:v3', 'bad-json')
    const store = makeVersionedStore('key:v3', [], { x: -1 })
    expect(store.load()).toEqual({ x: -1 })
  })

  it('save writes to current key', () => {
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: 0 })
    store.save({ x: 100 })
    expect(JSON.parse(localStorage.getItem('key:v3')!)).toEqual({ x: 100 })
  })

  it('load after save returns saved value', () => {
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: 0 })
    store.save({ x: 55 })
    expect(store.load()).toEqual({ x: 55 })
  })

  it('save returns true on success', () => {
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: 0 })
    expect(store.save({ x: 1 })).toBe(true)
  })

  it('save returns false when setItem throws (simulated quota exceeded)', () => {
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: 0 })
    mockStorage.setItem = () => { throw new DOMException('QuotaExceededError') }
    expect(store.save({ x: 99 })).toBe(false)
  })

  it('validate: valid current key passes through unchanged', () => {
    localStorage.setItem('key:v3', JSON.stringify({ x: 42 }))
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: 0 }, isX)
    expect(store.load()).toEqual({ x: 42 })
  })

  it('validate: invalid-shape current key returns fallback', () => {
    localStorage.setItem('key:v3', JSON.stringify({ notX: 'wrong' }))
    const store = makeVersionedStore<{ x: number }>('key:v3', [], { x: -1 }, isX)
    expect(store.load()).toEqual({ x: -1 })
  })
})
