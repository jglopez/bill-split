// ─── Bill schema versions and migrations ──────────────────────────────────────
//
// Every saved or shared bill carries a schema version. Data at the current
// version is used as is, with nothing imported from this directory beyond this
// file. Older data is upgraded one version at a time by step modules (vN.ts
// turns vN into vN+1), which are fetched lazily so they stay out of the main
// bundle until someone actually has old data.
//
// To change the BillState shape:
//   1. Bump CURRENT_BILL_VERSION.
//   2. Add vN.ts (N = the old version) exporting `migrate(raw: unknown)`, which
//      turns a vN payload into the vN+1 shape. Describe that shape with local
//      types, not BillState, so the step stays fixed as the schema moves on.
//   3. Register it in `steps` below.
//   4. Add vN.test.ts for the step's edge cases.
//   5. Add fixtures/v{N+1}.json: a bill in the new current format. Never edit
//      existing fixtures; they pin what old saved bills and links look like.
// meta.test.ts fails until all of these are in place.

export const CURRENT_BILL_VERSION = 2

export interface MigrationStep {
  migrate: (raw: unknown) => unknown
}

export type StepRegistry = Readonly<Record<number, () => Promise<MigrationStep>>>

export const steps: StepRegistry = {
  1: () => import('./v1'),
}

/** Data is from a newer app version than this one. The app should update. */
export class NewerSchemaError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`Bill schema v${version} is newer than this app (v${CURRENT_BILL_VERSION})`)
    this.name = 'NewerSchemaError'
    this.version = version
  }
}

/**
 * A migration step's code couldn't be fetched (offline, or a stale install
 * whose chunk is gone after a deploy). The data itself may be fine, so callers
 * must not discard it.
 */
export class MigrationLoadError extends Error {
  readonly cause: unknown
  constructor(fromVersion: number, cause: unknown) {
    super(`Couldn't load the migration from bill schema v${fromVersion}`)
    this.name = 'MigrationLoadError'
    this.cause = cause
  }
}

function assertKnownVersion(version: number): void {
  if (version > CURRENT_BILL_VERSION) throw new NewerSchemaError(version)
  if (!Number.isInteger(version) || version < 1) {
    throw new RangeError(`Unknown bill schema version: ${version}`)
  }
}

/**
 * Whether data at `version` must go through `migrateToCurrent`. Throws
 * NewerSchemaError for data from a newer app, RangeError for nonsense versions.
 */
export function needsMigration(version: number): boolean {
  assertKnownVersion(version)
  return version < CURRENT_BILL_VERSION
}

/**
 * Upgrade a payload from `fromVersion` to the current schema. Every needed
 * step is fetched in parallel, then applied in order. The result is unchecked:
 * callers validate it the same way they validate current-version data.
 *
 * Rejects with MigrationLoadError if a step can't be fetched, or with the
 * step's own error if the payload is invalid.
 */
export async function migrateToCurrent(
  raw: unknown,
  fromVersion: number,
  registry: StepRegistry = steps,
): Promise<unknown> {
  assertKnownVersion(fromVersion)
  const loaders: (() => Promise<MigrationStep>)[] = []
  for (let v = fromVersion; v < CURRENT_BILL_VERSION; v++) {
    const loader = registry[v]
    if (!loader) throw new RangeError(`No migration registered for bill schema v${v}`)
    loaders.push(loader)
  }

  let modules: MigrationStep[]
  try {
    modules = await Promise.all(loaders.map(load => load()))
  } catch (err) {
    throw new MigrationLoadError(fromVersion, err)
  }

  return modules.reduce<unknown>((data, step) => step.migrate(data), raw)
}
