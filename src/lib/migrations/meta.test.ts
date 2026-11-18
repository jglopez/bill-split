// Checks that every schema version follows the pattern in ./index.ts: each
// step has its own module, tests, and registry entry, and every version
// (including the current one) has a pinned fixture that still upgrades to a
// valid bill. Adding a version without the matching files fails here.

import { describe, it, expect } from 'vitest'
import { CURRENT_BILL_VERSION, migrateToCurrent, steps } from './index'
import { isBillState } from '../../hooks/useBillSplit'

const CHECKLIST = 'see the checklist at the top of src/lib/migrations/index.ts'

// Keys are paths like './v1.ts'. Globs are resolved at build time, so these
// reflect the files on disk without importing them.
function versionsOf(paths: string[], pattern: RegExp): number[] {
  return paths.flatMap(p => {
    const m = pattern.exec(p)
    return m ? [Number(m[1])] : []
  }).sort((a, b) => a - b)
}

const sourceFiles = Object.keys(import.meta.glob('./v*.ts'))
const stepFileVersions = versionsOf(sourceFiles, /^\.\/v(\d+)\.ts$/)
const stepTestVersions = versionsOf(sourceFiles, /^\.\/v(\d+)\.test\.ts$/)
const fixtures = import.meta.glob<unknown>('./fixtures/v*.json', { eager: true, import: 'default' })
const fixtureVersions = versionsOf(Object.keys(fixtures), /^\.\/fixtures\/v(\d+)\.json$/)
const registeredVersions = Object.keys(steps).map(Number).sort((a, b) => a - b)

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const allVersions = range(1, CURRENT_BILL_VERSION)
const stepVersions = range(1, CURRENT_BILL_VERSION - 1)

describe('migration meta', () => {
  describe.each(stepVersions)('step v%i', v => {
    it('has a module', () => {
      expect(stepFileVersions, `Missing src/lib/migrations/v${v}.ts (${CHECKLIST})`).toContain(v)
    })

    it('has its own tests', () => {
      expect(stepTestVersions, `Missing src/lib/migrations/v${v}.test.ts (${CHECKLIST})`).toContain(v)
    })

    it('is registered and exports migrate()', async () => {
      expect(registeredVersions, `v${v} is not registered in \`steps\` (${CHECKLIST})`).toContain(v)
      const mod = await steps[v]()
      expect(typeof mod.migrate, `v${v}.ts must export migrate(raw)`).toBe('function')
    })
  })

  describe.each(allVersions)('fixture v%i', v => {
    it('exists and upgrades to a valid bill', async () => {
      const path = `./fixtures/v${v}.json`
      expect(fixtureVersions, `Missing src/lib/migrations/fixtures/v${v}.json (${CHECKLIST})`).toContain(v)
      const result = await migrateToCurrent(fixtures[path], v)
      expect(isBillState(result), `fixtures/v${v}.json no longer upgrades to a valid bill`).toBe(true)
    })
  })

  it('has no step modules, tests, or registry entries for the current version or later', () => {
    const extra = (vs: number[]) => vs.filter(v => v >= CURRENT_BILL_VERSION)
    expect(extra(stepFileVersions), 'Step modules found for versions with nothing to upgrade to').toEqual([])
    expect(extra(stepTestVersions), 'Step tests found for versions with nothing to upgrade to').toEqual([])
    expect(extra(registeredVersions), 'Steps registered for versions with nothing to upgrade to').toEqual([])
  })

  it('has no fixtures newer than the current version', () => {
    expect(fixtureVersions.filter(v => v > CURRENT_BILL_VERSION)).toEqual([])
  })
})
