// ─── Versioned localStorage store ─────────────────────────────────────────────
//
// Each store owns one current key and an ordered list of (oldKey, migrate) pairs.
// On load, it tries the current key first. If absent, it walks the migration
// list, applies the first matching migration, writes the result to the current
// key, and removes the old key — all before first render. On save it writes to
// the current key only.

type Migration<T> = (raw: unknown) => T

interface VersionedStore<T> {
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
  migrations: [oldKey: string, migrate: Migration<T>][],
  fallback: T,
  // A plain boolean predicate, not a `v is T` type guard: validators may
  // accept an object missing fields that T declares required (e.g. an
  // optional-field backfill applied after load), so asserting the full type
  // here would be a false guarantee. `current as T` below is the one place
  // that cast happens, deliberately visible rather than hidden in the guard.
  validate?: (v: unknown) => boolean,
): VersionedStore<T> {
  return {
    load(): T {
      // Try the current key first.
      const current = readJSON(currentKey)
      if (current !== null) {
        // If a validator is supplied and the parsed value fails it, fall
        // through to migrations rather than returning malformed state.
        if (!validate || validate(current)) return current as T
      }

      // Walk migrations in order (most-recent old key first).
      for (const [oldKey, migrate] of migrations) {
        const raw = readJSON(oldKey)
        if (raw === null) continue

        try {
          const migrated = migrate(raw)
          writeJSON(currentKey, migrated)
          // Best-effort cleanup: a removeItem failure must not suppress the
          // migrated value that was already written to the current key.
          try { localStorage.removeItem(oldKey) } catch { /* ignore */ }
          return migrated
        } catch {
          // Migration failed — try the next entry.
        }
      }

      return fallback
    },

    save(value: T): boolean {
      return writeJSON(currentKey, value)
    },
  }
}
