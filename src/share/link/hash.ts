// The part of a bill link that the main bundle needs: recognising one in the
// address bar, and reading which person it points at. Kept apart from
// billLink.ts so checking the address doesn't load the compression code.

/**
 * Bill links carry the bill in the URL fragment, which browsers never send
 * to the server, so the bill stays between the people sharing it.
 */
export const BILL_HASH_PREFIX = '#b='

/**
 * Marks a link that points at one person's receipt. It follows the bill data
 * and holds that person's position in the link's own participant list. The
 * position, rather than an id or a name, is what the bill data itself uses:
 * ids aren't stored in links and names can repeat. It refers to the bill
 * snapshot in the same link, so later edits to the sender's bill can't
 * change who it means.
 */
export const PERSON_PARAM = '&p='

/** True when a location hash (including its `#`) holds a bill link. */
export function isBillHash(hash: string): boolean {
  return hash.startsWith(BILL_HASH_PREFIX)
}

export interface SplitBillHash {
  /** The fragment with only the bill in it. */
  bill: string
  /**
   * The position of the person the link points at, or null when it points at
   * no one in particular. A marker that isn't a plain position counts as
   * none: the bill still opens, it just doesn't scroll anywhere.
   */
  person: number | null
}

/** Separate a bill link fragment into the bill and the person it points at. */
export function splitBillHash(hash: string): SplitBillHash {
  const at = hash.indexOf(PERSON_PARAM)
  if (at === -1) return { bill: hash, person: null }
  const value = hash.slice(at + PERSON_PARAM.length)
  const person = /^\d{1,4}$/.test(value) ? Number(value) : null
  return { bill: hash.slice(0, at), person }
}

/** Point a bill link fragment at the person in `position`. */
export function withPerson(billHash: string, position: number): string {
  if (!Number.isInteger(position) || position < 0) throw new RangeError(`Not a participant position: ${position}`)
  return `${splitBillHash(billHash).bill}${PERSON_PARAM}${position}`
}
