// Schema step v3 → v4: bills gain an optional name.
//
// Bills saved before the name field existed are unnamed, which is an empty
// string.
//
// Like every step, this describes its output with local types instead of
// importing BillState, so later schema changes can't alter what it produces.

export interface V4Bill extends Record<string, unknown> {
  name: unknown
}

export function migrate(raw: unknown): V4Bill {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid v3 bill state: expected object')
  }
  const v3 = raw as Record<string, unknown>
  // Only an absent name is filled in. A present but invalid value is passed
  // through, so validation of the result still rejects it.
  return { ...v3, name: v3['name'] ?? '' }
}
