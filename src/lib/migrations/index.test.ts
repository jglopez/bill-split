// Version-agnostic tests for the migration runner. Per-version behavior lives
// in vN.test.ts, and meta.test.ts runs every pinned fixture.

import { describe, it, expect, vi } from 'vitest'
import {
  CURRENT_BILL_VERSION,
  MigrationLoadError,
  NewerSchemaError,
  migrateToCurrent,
  needsMigration,
  type StepRegistry,
} from './index'

describe('needsMigration', () => {
  it('is false at the current version', () => {
    expect(needsMigration(CURRENT_BILL_VERSION)).toBe(false)
  })

  it('is true below the current version', () => {
    expect(needsMigration(CURRENT_BILL_VERSION - 1)).toBe(true)
  })

  it('throws NewerSchemaError above the current version', () => {
    expect(() => needsMigration(CURRENT_BILL_VERSION + 1)).toThrow(NewerSchemaError)
  })

  it.each([0, -1, 1.5, NaN])('throws RangeError for version %s', version => {
    expect(() => needsMigration(version)).toThrow(RangeError)
  })
})

describe('migrateToCurrent', () => {
  it('loads no steps for current-version data and returns it unchanged', async () => {
    const loader = vi.fn()
    const registry: StepRegistry = { [CURRENT_BILL_VERSION - 1]: loader }
    const data = { anything: true }
    await expect(migrateToCurrent(data, CURRENT_BILL_VERSION, registry)).resolves.toBe(data)
    expect(loader).not.toHaveBeenCalled()
  })

  it('applies every needed step in order', async () => {
    const registry: StepRegistry = Object.fromEntries(
      Array.from({ length: CURRENT_BILL_VERSION }, (_, v) => [v, () => Promise.resolve({
        migrate: (raw: unknown) => [...(raw as number[]), v],
      })]),
    )
    await expect(migrateToCurrent([], 1, registry)).resolves.toEqual(
      Array.from({ length: CURRENT_BILL_VERSION - 1 }, (_, i) => i + 1),
    )
  })

  it('rejects newer data with NewerSchemaError', async () => {
    await expect(migrateToCurrent({}, CURRENT_BILL_VERSION + 1)).rejects.toBeInstanceOf(NewerSchemaError)
  })

  it('rejects unknown versions', async () => {
    await expect(migrateToCurrent({}, 0)).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects when a needed step is not registered', async () => {
    await expect(migrateToCurrent({}, CURRENT_BILL_VERSION - 1, {})).rejects.toBeInstanceOf(RangeError)
  })

  it('wraps a failed step fetch in MigrationLoadError', async () => {
    const prev = CURRENT_BILL_VERSION - 1
    const registry: StepRegistry = { [prev]: () => Promise.reject(new TypeError('Failed to fetch')) }
    await expect(migrateToCurrent({}, prev, registry)).rejects.toBeInstanceOf(MigrationLoadError)
  })

  it('passes a step’s own error through unwrapped', async () => {
    const prev = CURRENT_BILL_VERSION - 1
    const registry: StepRegistry = {
      [prev]: () => Promise.resolve({ migrate: () => { throw new Error('bad data') } }),
    }
    const err: unknown = await migrateToCurrent({}, prev, registry).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(MigrationLoadError)
    expect((err as Error).message).toBe('bad data')
  })
})
