import type { BillState } from '../types'
import { readJSON } from './versionedStore'

// Older builds kept the items table's column order in its own key, apart from
// the bill. The order now lives in the bill's participant list, so it reaches
// the settlement, the share summary and bill links. This key is read once to
// carry an existing order over, then removed.
export const LEGACY_COLUMN_ORDER_KEY = 'bill-split-column-order:v1'

/**
 * Put the bill's participants in a stored column order. Ids the bill doesn't
 * have are ignored, and participants the stored order doesn't list keep their
 * place after the listed ones, so corrupt or stale data can't lose or
 * duplicate anyone. Anything other than an array leaves the bill unchanged.
 */
export function applyColumnOrder(state: BillState, stored: unknown): BillState {
  if (!Array.isArray(stored)) return state
  const byId = new Map(state.participants.map(p => [p.id, p]))
  const listed = [...new Set(stored.filter((id): id is string => typeof id === 'string' && byId.has(id)))]
  const rest = state.participants.filter(p => !listed.includes(p.id))
  const participants = [...listed.map(id => byId.get(id)!), ...rest]
  const unchanged = participants.every((p, i) => p === state.participants[i])
  return unchanged ? state : { ...state, participants }
}

/** Apply the column order an older build saved, if there is one. */
export function adoptLegacyColumnOrder(state: BillState): BillState {
  return applyColumnOrder(state, readJSON(LEGACY_COLUMN_ORDER_KEY))
}

/** Remove the old key once the bill holding its order has been saved. */
export function clearLegacyColumnOrder(): void {
  try { localStorage.removeItem(LEGACY_COLUMN_ORDER_KEY) } catch { /* ignore */ }
}
