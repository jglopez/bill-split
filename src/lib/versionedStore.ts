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
  save: (value: T) => void
}

export function makeVersionedStore<T>(
  currentKey: string,
  migrations: [oldKey: string, migrate: Migration<T>][],
  fallback: T,
): VersionedStore<T> {
  return {
    load(): T {
      // Try the current key first.
      try {
        const raw = localStorage.getItem(currentKey)
        if (raw !== null) return JSON.parse(raw) as T
      } catch {
        // Corrupt JSON in the current key — fall through to migrations.
      }

      // Walk migrations in order (most-recent old key first).
      for (const [oldKey, migrate] of migrations) {
        const raw = localStorage.getItem(oldKey)
        if (raw === null) continue

        try {
          const migrated = migrate(JSON.parse(raw))
          localStorage.setItem(currentKey, JSON.stringify(migrated))
          localStorage.removeItem(oldKey)
          return migrated
        } catch {
          // Migration failed for this key — try the next one.
        }
      }

      return fallback
    },

    save(value: T): void {
      try {
        localStorage.setItem(currentKey, JSON.stringify(value))
      } catch {
        // Storage quota exceeded or private browsing — degrade silently.
      }
    },
  }
}
