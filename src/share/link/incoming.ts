// Opening a bill link that the page was loaded with. The decoding code is
// fetched only when the address actually holds a link.

import type { BillState } from '../../types'
import { MigrationLoadError } from '../../lib/migrations'
import { isBillHash, splitBillHash } from './hash'

export type IncomingLink =
  /**
   * `personId` is the participant the link points at (an id in `bill`), or
   * null when it points at no one or at a position the bill doesn't have.
   */
  | { kind: 'bill'; bill: BillState; personId: string | null }
  /** Made by a newer version of the app. Updating should open it. */
  | { kind: 'newer' }
  /** Damaged or truncated. Nothing can open it. */
  | { kind: 'malformed' }
  /** The code to open it couldn't be fetched. The link may be fine. */
  | { kind: 'unavailable' }

/** Read the bill link in `hash`, if there is one. Never rejects. */
export async function readIncomingLink(hash: string): Promise<IncomingLink | null> {
  if (!isBillHash(hash)) return null

  let mod: typeof import('./billLink')
  try {
    mod = await import('./billLink')
  } catch {
    return { kind: 'unavailable' }
  }

  try {
    const bill = await mod.decodeBillHash(hash)
    const { person } = splitBillHash(hash)
    const personId = person === null ? null : bill.participants[person]?.id ?? null
    return { kind: 'bill', bill, personId }
  } catch (err) {
    if (err instanceof mod.NewerLinkError) return { kind: 'newer' }
    if (err instanceof MigrationLoadError) return { kind: 'unavailable' }
    return { kind: 'malformed' }
  }
}

/**
 * Take the bill link out of the address bar once it's been handled, so a
 * reload doesn't offer it again, Back doesn't return to it, and the page
 * address can't be bookmarked or shared with the bill in it by accident.
 * It replaces the history entry rather than adding one. The browser's own
 * history list keeps the address as it was first visited; no page can
 * change that.
 */
export function clearIncomingLink(): void {
  if (!isBillHash(window.location.hash)) return
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
}
