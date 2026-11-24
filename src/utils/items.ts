import type { Item } from '../types'

/**
 * True when a person hasn't typed anything into the item: no name and no
 * price. The trailing placeholder row is always blank, so this is also how
 * code tells real items from that row.
 */
export function isItemBlank(item: Item): boolean {
  return item.name.trim() === '' && item.price.trim() === ''
}
