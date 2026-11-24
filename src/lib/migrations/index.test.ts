// Version-agnostic tests for the migration runner. Per-version behavior lives
// in vN.test.ts, and meta.test.ts runs every pinned fixture. The runner tests
// use their own version range and registry, so they exercise every code path
// even when the app has no migrations registered.

import { describe, it, expect, vi } from 'vitest'
import {
  CURRENT_BILL_VERSION,
  MigrationLoadError,
  NewerSchemaError,
  OLDEST_BILL_VERSION,
  migrateToCurrent,
  needsMigration,
  type SchemaRange,
  type StepRegistry,
} from './index'

// A made-up range with several steps, independent of the app's real one.
const RANGE: SchemaRange = { oldest: 2, current: 5 }

describe('bill schema range', () => {
  it('reads every version from the oldest supported one to the current one', () => {
    expect(Number.isInteger(OLDEST_BILL_VERSION)).toBe(true)
    expect(OLDEST_BILL_VERSION).toBeGreaterThanOrEqual(1)
    expect(OLDEST_BILL_VERSION).toBeLessThanOrEqual(CURRENT_BILL_VERSION)
  })

  it('needs no migration at the current version', () => {
    expect(needsMigration(CURRENT_BILL_VERSION)).toBe(false)
  })

  it('rejects versions older than the oldest supported one', () => {
    expect(() => needsMigration(OLDEST_BILL_VERSION - 1)).toThrow(RangeError)
  })
})

describe('needsMigration', () => {
  it('is false at the current version', () => {
    expect(needsMigration(RANGE.current, RANGE)).toBe(false)
  })

  it('is true from the oldest version up to the current one', () => {
    expect(needsMigration(RANGE.oldest, RANGE)).toBe(true)
    expect(needsMigration(RANGE.current - 1, RANGE)).toBe(true)
  })

  it('throws NewerSchemaError above the current version', () => {
    expect(() => needsMigration(RANGE.current + 1, RANGE)).toThrow(NewerSchemaError)
  })

  it('throws RangeError below the oldest supported version', () => {
    expect(() => needsMigration(RANGE.oldest - 1, RANGE)).toThrow(RangeError)
  })

  it.each([0, -1, 1.5, NaN])('throws RangeError for version %s', version => {
    expect(() => needsMigration(version, RANGE)).toThrow(RangeError)
  })
})

describe('migrateToCurrent', () => {
  const prev = RANGE.current - 1

  it('loads no steps for current-version data and returns it unchanged', async () => {
    const loader = vi.fn()
    const registry: StepRegistry = { [prev]: loader }
    const data = { anything: true }
    await expect(migrateToCurrent(data, RANGE.current, registry, RANGE)).resolves.toBe(data)
    expect(loader).not.toHaveBeenCalled()
  })

  it('returns current-version data unchanged with the app registry', async () => {
    const data = { anything: true }
    await expect(migrateToCurrent(data, CURRENT_BILL_VERSION)).resolves.toBe(data)
  })

  it('applies every needed step in order', async () => {
    const registry: StepRegistry = Object.fromEntries(
      Array.from({ length: RANGE.current - RANGE.oldest }, (_, i) => {
        const v = RANGE.oldest + i
        return [v, () => Promise.resolve({ migrate: (raw: unknown) => [...(raw as number[]), v] })]
      }),
    )
    await expect(migrateToCurrent([], RANGE.oldest, registry, RANGE)).resolves.toEqual(
      Array.from({ length: RANGE.current - RANGE.oldest }, (_, i) => RANGE.oldest + i),
    )
  })

  it('rejects newer data with NewerSchemaError', async () => {
    await expect(migrateToCurrent({}, CURRENT_BILL_VERSION + 1)).rejects.toBeInstanceOf(NewerSchemaError)
  })

  it('rejects data older than the oldest supported version', async () => {
    await expect(migrateToCurrent({}, RANGE.oldest - 1, {}, RANGE)).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects unknown versions', async () => {
    await expect(migrateToCurrent({}, 0)).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects when a needed step is not registered', async () => {
    await expect(migrateToCurrent({}, prev, {}, RANGE)).rejects.toBeInstanceOf(RangeError)
  })

  it('wraps a failed step fetch in MigrationLoadError', async () => {
    const registry: StepRegistry = { [prev]: () => Promise.reject(new TypeError('Failed to fetch')) }
    await expect(migrateToCurrent({}, prev, registry, RANGE)).rejects.toBeInstanceOf(MigrationLoadError)
  })

  it('passes a step’s own error through unwrapped', async () => {
    const registry: StepRegistry = {
      [prev]: () => Promise.resolve({ migrate: () => { throw new Error('bad data') } }),
    }
    const err: unknown = await migrateToCurrent({}, prev, registry, RANGE).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(MigrationLoadError)
    expect((err as Error).message).toBe('bad data')
  })
})
