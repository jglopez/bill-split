// Tests for the v1 → v2 schema step.

import { describe, it, expect } from 'vitest'
import { migrate } from './v1'

// ─── Fuzz tests ───────────────────────────────────────────────────────────────

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

describe('v1 → v2 (fuzz)', () => {
  it('assignedTo is never [] after migration (50 payloads × up to 10 items)', () => {
    for (let i = 0; i < 50; i++) {
      const itemCount = Math.floor(Math.random() * 10) + 1
      const payload = randomV1(itemCount)
      const result = migrate(payload)

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
      const result = migrate(payload)

      for (let j = 0; j < items.length; j++) {
        expect(result.items[j].assignedTo).toEqual(items[j].assignedTo)
      }
    }
  })

  it('empty items array produces empty items (20 payloads)', () => {
    for (let i = 0; i < 20; i++) {
      const result = migrate({ items: [] })
      expect(result.items).toEqual([])
    }
  })

  it('missing items field produces empty items array', () => {
    const result = migrate({ tax: '5.00' })
    expect(result.items).toEqual([])
  })

  it('null payload fields do not crash migration', () => {
    const result = migrate({ items: undefined, participants: undefined })
    expect(Array.isArray(result.items)).toBe(true)
  })
})

// ─── Validation tests ─────────────────────────────────────────────────────────

function assertThrows(fn: () => unknown) {
  let threw = false
  try { fn() } catch { threw = true }
  expect(threw).toBe(true)
}

describe('v1 → v2 (validation)', () => {
  it('throws when assignedTo is a string', () => {
    assertThrows(
      () => migrate({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: 'invalid' }] }),
    )
  })

  it('throws when assignedTo is a boolean', () => {
    assertThrows(
      () => migrate({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: true }] }),
    )
  })

  it('throws when assignedTo is a plain object', () => {
    assertThrows(
      () => migrate({ items: [{ id: 'x', name: 'x', price: '1.00', assignedTo: { ids: [] } }] }),
    )
  })

  it('throws when price is a number instead of string', () => {
    assertThrows(
      () => migrate({ items: [{ id: 'x', name: 'x', price: 9.99, assignedTo: null }] }),
    )
  })
})
