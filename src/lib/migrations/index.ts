// ─── Bill schema versions and migrations ──────────────────────────────────────
//
// Every saved or shared bill carries a schema version. Data at the current
// version is used as is, with nothing imported from this directory beyond this
// file. Older data is upgraded one version at a time by step modules (vN.ts
// turns vN into vN+1), which are fetched lazily so they stay out of the main
// bundle until someone actually has old data.
//
// OLDEST_BILL_VERSION is the oldest version this app still reads. Data older
// than it is rejected as unknown. Raising it retires migrations, which drops
// support for data people may still have, so it's a deliberate owner decision,
// never a cleanup. When it equals CURRENT_BILL_VERSION, there are no steps.
//
// To change the BillState shape:
//   1. Bump CURRENT_BILL_VERSION. Leave OLDEST_BILL_VERSION alone.
//   2. Add vN.ts (N = the old version) exporting `migrate(raw: unknown)`, which
//      turns a vN payload into the vN+1 shape. Describe that shape with local
//      types, not BillState, so the step stays fixed as the schema moves on.
//   3. Register it in `steps` below.
//   4. Add vN.test.ts for the step's edge cases.
//   5. Add fixtures/v{N+1}.json: a bill in the new current format. Never edit
//      existing fixtures; they pin what old saved bills and links look like.
//   6. Add a bill link format for the new schema in src/share/link/formats/
//      and make it the latest, with a pinned link (see billLink.ts).
// meta.test.ts fails until steps 1 to 5 are in place, and
// src/share/link/billLink.test.ts fails until step 6 is.

export const CURRENT_BILL_VERSION = 4

/** The oldest schema version this app can still read. See above before raising it. */
export const OLDEST_BILL_VERSION = 4

export interface MigrationStep {
  migrate: (raw: unknown) => unknown
}

export type StepRegistry = Readonly<Record<number, () => Promise<MigrationStep>>>

// One entry per version from OLDEST_BILL_VERSION up to, but not including,
// CURRENT_BILL_VERSION, in the form `N: () => import('./vN')`.
export const steps: StepRegistry = {}

/** The schema versions a runner accepts. Tests pass their own. */
export interface SchemaRange {
  oldest: number
  current: number
}

const BILL_SCHEMA: SchemaRange = { oldest: OLDEST_BILL_VERSION, current: CURRENT_BILL_VERSION }

/** Data is from a newer app version than this one. The app should update. */
export class NewerSchemaError extends Error {
  readonly version: number
  constructor(version: number, current: number = CURRENT_BILL_VERSION) {
    super(`Bill schema v${version} is newer than this app (v${current})`)
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

function assertKnownVersion(version: number, range: SchemaRange): void {
  if (version > range.current) throw new NewerSchemaError(version, range.current)
  if (!Number.isInteger(version) || version < 1) {
    throw new RangeError(`Unknown bill schema version: ${version}`)
  }
  if (version < range.oldest) {
    throw new RangeError(`Bill schema v${version} is older than the oldest this app reads (v${range.oldest})`)
  }
}

/**
 * Whether data at `version` must go through `migrateToCurrent`. Throws
 * NewerSchemaError for data from a newer app, RangeError for nonsense versions
 * and for versions older than the oldest supported one.
 */
export function needsMigration(version: number, range: SchemaRange = BILL_SCHEMA): boolean {
  assertKnownVersion(version, range)
  return version < range.current
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
  range: SchemaRange = BILL_SCHEMA,
): Promise<unknown> {
  assertKnownVersion(fromVersion, range)
  const loaders: (() => Promise<MigrationStep>)[] = []
  for (let v = fromVersion; v < range.current; v++) {
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
