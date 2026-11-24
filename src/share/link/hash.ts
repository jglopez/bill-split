// The part of a bill link that the main bundle needs: recognising one in the
// address bar. Kept apart from billLink.ts so checking the address doesn't
// load the compression code.

/**
 * Bill links carry the bill in the URL fragment, which browsers never send
 * to the server, so the bill stays between the people sharing it.
 */
export const BILL_HASH_PREFIX = '#b='

/** True when a location hash (including its `#`) holds a bill link. */
export function isBillHash(hash: string): boolean {
  return hash.startsWith(BILL_HASH_PREFIX)
}
