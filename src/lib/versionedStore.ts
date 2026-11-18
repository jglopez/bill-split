// ─── Versioned localStorage store ─────────────────────────────────────────────
//
// Each store owns one current key and a list of legacy keys, each tagged with
// the schema version its data is in. Loading happens in two phases:
//
// 1. migrate() (async) runs once at startup, before first render. If the
//    current key already holds valid data it returns without doing anything,
//    so no migration code is fetched. Otherwise it upgrades the first legacy
//    key that exists, writes the result to the current key, and removes the
//    legacy key.
// 2. load() (sync) reads the current key, so it can run inside a reducer
//    initializer.
//
// Migration has to finish before render: the app saves on mount, and a save
// of default state to the current key would hide the legacy data for good.

import { MigrationLoadError } from './migrations'

interface VersionedStore<T> {
  /** Upgrade legacy data, if any. Rejects only with MigrationLoadError. */
  migrate: () => Promise<void>
  load: () => T
  save: (value: T) => boolean
}

/** Read and JSON-parse a localStorage key. Returns null if absent, blocked, or corrupt. */
export function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) as unknown : null
  } catch {
    return null
  }
}

/** JSON-serialize and write a value to localStorage. Returns true on success. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function makeVersionedStore<T>(
  currentKey: string,
  // Most recent first.
  legacyKeys: [oldKey: string, version: number][],
  fallback: T,
  // A plain boolean predicate, so the store doesn't dictate how callers check
  // their data. The `as T` casts below trust it, deliberately visible rather
  // than hidden in a type guard.
  validate: (v: unknown) => boolean = () => true,
  upgrade: (raw: unknown, fromVersion: number) => Promise<unknown> = () =>
    Promise.reject(new Error('No migrations configured')),
): VersionedStore<T> {
  // Holds a migrated value when it couldn't be written to storage, so this
  // session still sees it. The legacy key is kept in that case.
  let unsaved: T | null = null

  function readCurrent(): T | null {
    const current = readJSON(currentKey)
    return current !== null && validate(current) ? current as T : null
  }

  return {
    async migrate(): Promise<void> {
      if (readCurrent() !== null) return

      for (const [oldKey, version] of legacyKeys) {
        const raw = readJSON(oldKey)
        if (raw === null) continue

        let migrated: unknown
        try {
          migrated = await upgrade(raw, version)
        } catch (err) {
          // The data may be fine; the code to upgrade it just didn't arrive.
          // Let the caller stop before anything overwrites it.
          if (err instanceof MigrationLoadError) throw err
          continue // Invalid legacy data: try the next key.
        }
        if (!validate(migrated)) continue

        if (!writeJSON(currentKey, migrated)) {
          unsaved = migrated as T
          return
        }
        // Best-effort cleanup: a removeItem failure must not undo a migration
        // that was already written to the current key.
        try { localStorage.removeItem(oldKey) } catch { /* ignore */ }
        return
      }
    },

    load(): T {
      return readCurrent() ?? unsaved ?? fallback
    },

    save(value: T): boolean {
      return writeJSON(currentKey, value)
    },
  }
}
