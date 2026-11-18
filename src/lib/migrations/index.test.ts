import { describe, it, expect, vi } from 'vitest'
import {
  CURRENT_BILL_VERSION,
  MigrationLoadError,
  NewerSchemaError,
  migrateToCurrent,
  needsMigration,
  type StepRegistry,
} from './index'
import { isBillState } from '../../hooks/useBillSplit'
import v1Fixture from './fixtures/v1.json'
import v2Fixture from './fixtures/v2.json'

describe('needsMigration', () => {
  it('is false at the current version', () => {
    expect(needsMigration(CURRENT_BILL_VERSION)).toBe(false)
  })

  it('is true below the current version', () => {
    expect(needsMigration(1)).toBe(true)
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
    const registry: StepRegistry = { 1: loader }
    const data = { anything: true }
    await expect(migrateToCurrent(data, CURRENT_BILL_VERSION, registry)).resolves.toBe(data)
    expect(loader).not.toHaveBeenCalled()
  })

  it('rejects newer data with NewerSchemaError', async () => {
    await expect(migrateToCurrent({}, CURRENT_BILL_VERSION + 1)).rejects.toBeInstanceOf(NewerSchemaError)
  })

  it('rejects unknown versions', async () => {
    await expect(migrateToCurrent({}, 0)).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects when a needed step is not registered', async () => {
    await expect(migrateToCurrent({}, 1, {})).rejects.toBeInstanceOf(RangeError)
  })

  it('wraps a failed step fetch in MigrationLoadError', async () => {
    const registry: StepRegistry = { 1: () => Promise.reject(new TypeError('Failed to fetch')) }
    await expect(migrateToCurrent({}, 1, registry)).rejects.toBeInstanceOf(MigrationLoadError)
  })

  it('passes a step’s own error through unwrapped', async () => {
    const registry: StepRegistry = {
      1: () => Promise.resolve({ migrate: () => { throw new Error('bad data') } }),
    }
    const err: unknown = await migrateToCurrent({}, 1, registry).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(MigrationLoadError)
    expect((err as Error).message).toBe('bad data')
  })

  it('accepts the pinned v2 fixture as is', async () => {
    const result = await migrateToCurrent(v2Fixture, 2)
    expect(result).toBe(v2Fixture)
    expect(isBillState(result)).toBe(true)
  })

  it('upgrades the pinned v1 fixture to the expected bill', async () => {
    const result = await migrateToCurrent(v1Fixture, 1)
    expect(isBillState(result)).toBe(true)
    expect(result).toEqual({
      ...v1Fixture,
      tipDiscountBase: 'pre-discount',
      tipFeeBase: 'pre-fee',
      items: [
        { id: 'i-pizza', name: 'Pizza', price: '24.00', assignedTo: null },
        { id: 'i-salad', name: 'Salad', price: '9.50', assignedTo: ['p-sam'] },
        { id: 'i-blank', name: '', price: '', assignedTo: null },
      ],
    })
  })
})
